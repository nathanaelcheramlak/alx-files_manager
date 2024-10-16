#!/usr/bin/node
/* eslint-disable import/no-named-as-default */
/* eslint-disable no-unused-vars */
import { tmpdir } from "os";
import { promisify } from "util";
import Queue from "bull/lib/queue";
import { v4 as uuidv4 } from "uuid";
import { mkdir, writeFile, stat, existsSync, realpath } from "fs";
import { join as joinPath } from "path";
import { Request, Response } from "express";
import { contentType } from "mime-types";
import mongoDBCore from "mongodb/lib/core";
import dbClient from "../utils/db";
import { getUserFromXToken } from "../utils/auth";

const VALID_FILE_TYPES = {
  folder: "folder",
  file: "file",
  image: "image",
};
const ROOT_FOLDER_ID = 0;
const DEFAULT_ROOT_FOLDER = "files_manager";
const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);
const MAX_FILES_PER_PAGE = 20;
const fileQueue = new Queue("thumbnail generation");
const NULL_ID = Buffer.alloc(24, "0").toString("utf-8");
const isValidId = (id) => {
  const size = 24;
  let i = 0;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== "string" || id.length !== size) {
    return false;
  }
  while (i < size) {
    const c = id[i];
    const code = c.charCodeAt(0);

    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
    i += 1;
  }
  return true;
};

export default class FilesController {
  static async postUpload(req, res) {
    const { user } = req;
    const name = req.body ? req.body.name : null;
    const type = req.body ? req.body.type : null;
    const parentId =
      req.body && req.body.parentId ? req.body.parentId : ROOT_FOLDER_ID;
    const isPublic = req.body && req.body.isPublic ? req.body.isPublic : false;
    const base64Data = req.body && req.body.data ? req.body.data : "";

    if (!name) {
      res.status(400).json({ error: "Missing name" });
      return;
    }
    if (!type || !Object.values(VALID_FILE_TYPES).includes(type)) {
      res.status(400).json({ error: "Missing type" });
      return;
    }
    if (!req.body.data && type !== VALID_FILE_TYPES.folder) {
      res.status(400).json({ error: "Missing data" });
      return;
    }
    if (parentId !== ROOT_FOLDER_ID && parentId !== ROOT_FOLDER_ID.toString()) {
      const file = await (
        await dbClient.filesCollection()
      ).findOne({
        _id: new mongoDBCore.BSON.ObjectId(
          isValidId(parentId) ? parentId : NULL_ID
        ),
      });

      if (!file) {
        res.status(400).json({ error: "Parent not found" });
        return;
      }
      if (file.type !== VALID_FILE_TYPES.folder) {
        res.status(400).json({ error: "Parent is not a folder" });
        return;
      }
    }
    const userId = user._id.toString();
    const baseDir =
      `${process.env.FOLDER_PATH || ""}`.trim().length > 0
        ? process.env.FOLDER_PATH.trim()
        : joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);
    // default baseDir == '/tmp/files_manager'
    // or (on Windows) '%USERPROFILE%/AppData/Local/Temp/files_manager';
    const newFile = {
      userId: new mongoDBCore.BSON.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId:
        parentId === ROOT_FOLDER_ID || parentId === ROOT_FOLDER_ID.toString()
          ? "0"
          : new mongoDBCore.BSON.ObjectId(parentId),
    };
    await mkDirAsync(baseDir, { recursive: true });
    if (type !== VALID_FILE_TYPES.folder) {
      const localPath = joinPath(baseDir, uuidv4());
      await writeFileAsync(localPath, Buffer.from(base64Data, "base64"));
      newFile.localPath = localPath;
    }
    const insertionInfo = await (
      await dbClient.filesCollection()
    ).insertOne(newFile);
    const fileId = insertionInfo.insertedId.toString();
    // start thumbnail generation worker
    if (type === VALID_FILE_TYPES.image) {
      const jobName = `Image thumbnail [${userId}-${fileId}]`;
      fileQueue.add({ userId, fileId, name: jobName });
    }
    res.status(201).json({
      id: fileId,
      userId,
      name,
      type,
      isPublic,
      parentId:
        parentId === ROOT_FOLDER_ID || parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : parentId,
    });
  }

  static async getShow(req, res) {
    const { user } = req;
    const id = req.params ? req.params.id : NULL_ID;
    const userId = user._id.toString();
    const file = await (
      await dbClient.filesCollection()
    ).findOne({
      _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
      userId: new mongoDBCore.BSON.ObjectId(
        isValidId(userId) ? userId : NULL_ID
      ),
    });

    if (!file) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId:
        file.parentId === ROOT_FOLDER_ID.toString()
          ? 0
          : file.parentId.toString(),
    });
  }

  static async getIndex(req, res) {
    const { user } = req;
    const parentId = req.query.parentId || ROOT_FOLDER_ID.toString();
    const page = /\d+/.test((req.query.page || "").toString())
      ? Number.parseInt(req.query.page, 10)
      : 0;
    const filesFilter = {
      userId: user._id,
      parentId:
        parentId === ROOT_FOLDER_ID.toString()
          ? parentId
          : new mongoDBCore.BSON.ObjectId(
              isValidId(parentId) ? parentId : NULL_ID
            ),
    };

    const files = await (
      await (
        await dbClient.filesCollection()
      ).aggregate([
        { $match: filesFilter },
        { $sort: { _id: -1 } },
        { $skip: page * MAX_FILES_PER_PAGE },
        { $limit: MAX_FILES_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: "$_id",
            userId: "$userId",
            name: "$name",
            type: "$type",
            isPublic: "$isPublic",
            parentId: {
              $cond: {
                if: { $eq: ["$parentId", "0"] },
                then: 0,
                else: "$parentId",
              },
            },
          },
        },
      ])
    ).toArray();
    res.status(200).json(files);
  }

  static async putPublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: "Unauthorized" });
    }
    const { id } = request.params;
    const files = dbClient.db.collection("files");
    const idObject = new ObjectID(id);
    const newValue = { $set: { isPublic: true } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate(
      { _id: idObject, userId: user._id },
      newValue,
      options,
      (err, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          return response.status(404).json({ error: "Not found" });
        }
        return response.status(200).json(file.value);
      }
    );
    return null;
  }

  static async putUnpublish(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: "Unauthorized" });
    }
    const { id } = request.params;
    const files = dbClient.db.collection("files");
    const idObject = new ObjectID(id);
    const newValue = { $set: { isPublic: false } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate(
      { _id: idObject, userId: user._id },
      newValue,
      options,
      (err, file) => {
        if (!file.lastErrorObject.updatedExisting) {
          return response.status(404).json({ error: "Not found" });
        }
        return response.status(200).json(file.value);
      }
    );
    return null;
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const files = dbClient.db.collection("files");
    const idObject = new ObjectID(id);
    files.findOne({ _id: idObject }, async (err, file) => {
      if (!file) {
        return response.status(404).json({ error: "Not found" });
      }
      console.log(file.localPath);
      if (file.isPublic) {
        if (file.type === "folder") {
          return response
            .status(400)
            .json({ error: "A folder doesn't have content" });
        }
        try {
          let fileName = file.localPath;
          const size = request.param("size");
          if (size) {
            fileName = `${file.localPath}_${size}`;
          }
          const data = await fs.readFile(fileName);
          const contentType = mime.contentType(file.name);
          return response
            .header("Content-Type", contentType)
            .status(200)
            .send(data);
        } catch (error) {
          console.log(error);
          return response.status(404).json({ error: "Not found" });
        }
      } else {
        const user = await FilesController.getUser(request);
        if (!user) {
          return response.status(404).json({ error: "Not found" });
        }
        if (file.userId.toString() === user._id.toString()) {
          if (file.type === "folder") {
            return response
              .status(400)
              .json({ error: "A folder doesn't have content" });
          }
          try {
            let fileName = file.localPath;
            const size = request.param("size");
            if (size) {
              fileName = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name);
            return response
              .header("Content-Type", contentType)
              .status(200)
              .sendFile(fileName);
          } catch (error) {
            console.log(error);
            return response.status(404).json({ error: "Not found" });
          }
        } else {
          console.log(
            `Wrong user: file.userId=${file.userId}; userId=${user._id}`
          );
          return response.status(404).json({ error: "Not found" });
        }
      }
    });
  }
}
