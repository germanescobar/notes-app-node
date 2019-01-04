const express = require("express");
const mongoose = require("mongoose");
const Note = require("./models/Note");
const cookieSession = require('cookie-session')
const app = express();

mongoose.connect("mongodb://localhost:27017/notes", { useNewUrlParser: true });

app.set("view engine", "pug");
app.set("views", "views");
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  secret: "una_cadena_secreta",
  maxAge: 24 * 60 * 60 * 1000
}));
app.use("/static", express.static("public"));

// muestra la lista de notas
app.get("/", async (req, res) => {
  const notes = await Note.find();
  res.render("index", { notes });
});

// muestra el formulario para crear una nota
app.get("/notes/new", (req, res) => {
  res.render("new");
});

// permite crear una nota
app.post("/notes", async (req, res, next) => {
  const data = {
    title: req.body.title,
    body: req.body.body
  };

  try {
    const note = new Note(data);
    await note.save();
  } catch(e) {
    return next(e);
  }

  res.redirect("/");
});

app.listen(3000, () => console.log("Listening on port 3000 ..."));
