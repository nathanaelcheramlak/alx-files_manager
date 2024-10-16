#!/usr/bin/node
import { app } from "../server";


app.get('/family', (req, res) => {
    const familyMembers = ["Nathanael", "Joshua", "Kidus", "Cheramlak", "Metasebia"]
    res.send(familyMembers);
})

app.get('stats', (req, res) => {

})