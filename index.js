require('dotenv').config();
const aws = require('aws-sdk');
const express = require("express");
const mongoose = require("mongoose");
const Note = require("./models/Note");
const User = require("./models/User");
const cookieSession = require("cookie-session")
const md = require("marked");
const multer  = require('multer');
const multerS3 = require('multer-s3');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const PORT = process.env.PORT || 3000;

const app = express();

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/notes", { useNewUrlParser: true });
var s3 = new aws.S3({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
  region: "us-west-2"
})

app.set("view engine", "pug");
app.set("views", "views");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieSession({
  secret: "una_cadena_secreta",
  maxAge: 24 * 60 * 60 * 1000
}));
app.use("/assets", express.static("assets"));
app.use("/uploads", express.static("uploads"));

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'notes-prod',
    acl: "public-read",
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString())
    }
  })
});

const requireUser = (req, res, next) => {
  if (!res.locals.user) {
    return res.redirect("/login");
  }

  next();
};

const requireApiUser = async (req, res, next) => {
  const token = req.header("Authorization");

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const user = await User.findById(decoded.userId);
    if (user) {
      res.locals.user = user;
      next();
    } else {
      res.status(401).send({ error: "Not authenticated" });
    }
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      res.status(401).send({ error: "Invalid token" });
    } else {
      return next(err);
    }
  }
}

app.use(async (req, res, next) => {
  const userId = req.session.userId;
  if (userId) {
    const user = await User.findById(userId);
    if (user) {
      res.locals.user = user;
    } else {
      delete req.session.userId;
    }
  }

  next();
});

// muestra la lista de notas
app.get("/", requireUser, async (req, res) => {
  const notes = await Note.find({ user: res.locals.user });
  res.render("index", { notes });
});

// muestra el formulario para crear una nota
app.get("/notes/new", requireUser, async (req, res) => {
  const notes = await Note.find({ user: res.locals.user });
  res.render("new", { notes });
});

// permite crear una nota
app.post("/notes", async (req, res, next) => {
  const data = {
    title: req.body.title,
    body: req.body.body,
    user: res.locals.user,
    image: req.file.location
  };

  try {
    const note = new Note(data);
    await note.save();

    res.redirect("/");
  } catch(err) {
    if (err.name === "ValidationError") {
      const notes = await Note.find({ user: res.locals.user });
      res.render("new", { errors: err.errors, notes });
    } else {
      return next(err);
    }
  }
});

// muestra una nota
app.get("/notes/:id", requireUser, async (req, res) => {
  const notes = await Note.find({ user: res.locals.user });
  const note = await Note.findById(req.params.id);
  res.render("show", { notes: notes, currentNote: note, md: md });
});

// muestra el formulario para editar
app.get("/notes/:id/edit", requireUser, async (req, res, next) => {
  try {
    const notes = await Note.find();
    const note = await Note.findById(req.params.id);

    res.render("edit", { notes: notes, currentNote: note });
  } catch (e) {
    return next(e);
  }
});

// actualiza una nota
app.patch("/notes/:id", requireUser, async (req, res, next) => {
  const id = req.params.id;
  const note = await Note.findById(id);

  note.title = req.body.title;
  note.body = req.body.body;

  try {
    await note.save({});
    res.status(204).send({});
  } catch (e) {
    return next(e);
  }
});

app.delete("/notes/:id", requireUser, async (req, res, next) => {
  try {
    await Note.deleteOne({ _id: req.params.id });
    res.status(204).send({});
  } catch (e) {
    return next(e);
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res, next) => {
  try {
    const user = await User.create({
      email: req.body.email,
      password: req.body.password
    });
    res.redirect("/login");
  } catch (err) {
    if (err.name === "ValidationError") {
      res.render("register", { errors: err.errors });
    } else {
      return next(err);
    }
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res, next) => {
  try {
    const user = await User.authenticate(req.body.email, req.body.password);
    if (user) {
      req.session.userId = user._id;
      return res.redirect("/");
    } else {
      res.render("login", { error: "Wrong email or password. Try again!" });
    }
  } catch (err) {
    return next(err);
  }
});

app.get("/logout", requireUser, (req, res) => {
  res.session = null;
  res.clearCookie("session");
  res.clearCookie("session.sig");
  res.redirect("/login");
});

app.get("/auth/github/callback", async (req, res, next) => {
  const code = req.query.code;

  try {
    // pedir el token a Github
    let response = await axios.post("https://github.com/login/oauth/access_token", {
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      code: code
    }, { headers: { "Accept": "application/json" } });

    const token = response.data.access_token;

    // pedir el email del usuario
    response = await axios.get("https://api.github.com/user/emails?access_token=" + token);

    // crear o autenticar el usuario
    const email = response.data[0].email;

    let user = await User.findOne({ email: email });
    if (!user) {
      user = await User.create({
        email: email,
        password: "secret"
      });
    }

    req.session.userId = user._id;
    res.redirect("/");
  } catch (err) {
    return next(err);
  }

})

app.post("/api/auth", async (req, res, next) => {
  try {
    const user = await User.authenticate(req.body.email, req.body.password);
    if (user) {
      const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY);
      res.json({ token });
    } else {
      res.status(401).send({ error: "Invalid username or password" });
    }
  } catch (err) {
    return next(err);
  }
});

app.get("/api/notes", requireApiUser, async (req, res, next) => {
  try {
    const notes = await Note.find({ user: res.locals.user });
    res.json(notes);
  } catch (err) {
    return next(err);
  }
});

app.post("/api/notes", requireApiUser, async (req, res, next) => {
  const data = {
    title: req.body.title,
    body: req.body.body,
    user: res.locals.user
  };

  try {
    const note = new Note(data);
    await note.save();

    res.json(note);
  } catch (err) {
    if (err.name === "ValidationError") {
      res.status(422).json(err.errors);
    } else {
      return next(err);
    }
  }
});


app.listen(PORT, () => console.log(`Listening on port ${PORT} ...`));
