const express = require("express");
const cookieSession = require('cookie-session')
const app = express();

app.set("view engine", "pug");
app.set("views", "views");
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  secret: "una_cadena_secreta",
  maxAge: 24 * 60 * 60 * 1000
}));
app.use("/static", express.static("public"));

// muestra la lista de notas
app.get("/", (req, res) => {
  const notes = req.session.notes || [];
  res.render("index", { notes });
});

// muestra el formulario para crear una nota
app.get("/notes/new", (req, res) => {
  res.render("new");
});

// permite crear una nota
app.post("/notes", (req, res) => {
  req.session.id = (req.session.id || 0) + 1;
  const id = req.session.id

  req.session.notes = req.session.notes || [];
  req.session.notes.push({ id: id, title: req.body.title, body: req.body.body });
  res.redirect("/");
});

app.listen(3000, () => console.log("Listening on port 3000 ..."));
