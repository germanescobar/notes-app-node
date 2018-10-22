const express = require("express");
const app = express();

app.use("/static", express.static("public"));

app.get("/", (req, res) => {
  const name = req.query.name;
  const age = req.query.age;

  res.send(`<h1>Hola ${name}, tienes ${age} años</h1>`);
});

app.get("/users/:name", (req, res) => {
  const name = req.params.name;
  res.send(`<h1>Hola ${name}</h1>`);
})

app.post("/users", (req, res) => {
  res.status(404)
  res.set("Content-Type", "text/plain");
  res.send("No se encontró el recurso");
});


app.listen(3000, () => console.log("Listening on port 3000 ..."));
