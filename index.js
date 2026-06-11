import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
dotenv.config();

//======MIDDLEWARE======
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden" });
    }

    req.user = decoded;
    next();
  });
};
const app = express();
app.use(cors({
  origin: ["http://localhost:5173"], 
  credentials: true
}));


app.use(express.json());

// ✅ Use only env
const client = new MongoClient(process.env.MONGO_URI);

let blogCollection;
let wishlistCollection;
let commentCollection;
async function run() {
  try {
    await client.connect();

    const db = client.db("blogDB");
    blogCollection = db.collection("blogs");
    wishlistCollection = db.collection("wishlist");
    commentCollection = db.collection("comments");
   await blogCollection.createIndex({ title: "text" });
    console.log("MongoDB connected");
  } catch (error) {
    console.log(error);
  }
}
run();


// ================= BLOG API =================

// CREATE BLOG
app.post("/blogs", verifyToken, async (req, res) => {
  const blog = req.body;

  blog.createdAt = new Date();
  blog.email = req.user.email; //important

  const result = await blogCollection.insertOne(blog);
  res.send(result);
});

// GET ALL BLOGS
app.get("/blogs", async (req, res) => {
  const result = await blogCollection
    .find()
    .sort({ createdAt: -1 })
    .toArray();

  res.send(result);
});

// GET SINGLE BLOG
app.get("/blogs/:id", async (req, res) => {
  const id = req.params.id;

  const result = await blogCollection.findOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});
//  UPDATE BLOG
app.put("/blogs/:id", verifyToken, async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;

  const blog = await blogCollection.findOne({
    _id: new ObjectId(id),
  });

  if (blog.email !== req.user.email) {
    return res.status(403).send({ message: "Forbidden" });
  }

  const result = await blogCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedData }
  );

  res.send(result);
});

// ================= WISHLIST API =================

// ADD TO WISHLIST
app.post("/wishlist", async (req, res) => {
  try {
    const { blogId, email } = req.body;

    // check duplicate
    const existing = await wishlistCollection.findOne({ blogId, email });

    if (existing) {
      return res.send({ message: "Already added" });
    }

    const result = await wishlistCollection.insertOne(req.body);
    res.send({ insertedId: result.insertedId });

  } catch (error) {
    res.status(500).send({ message: "Failed to add wishlist" });
  }
});
// GET USER WISHLIST
app.get("/wishlist/:email", verifyToken, async (req, res) => {
  if (req.user.email !== req.params.email) {
    return res.status(403).send({ message: "Forbidden access" });
  }

  const result = await wishlistCollection
    .find({ email: req.params.email })
    .toArray();

  res.send(result);
});

// DELETE WISHLIST
app.delete("/wishlist/:id", verifyToken, async (req, res) => {
  const id = req.params.id;

  const item = await wishlistCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!item) {
    return res.status(404).send({ message: "Not found" });
  }

  // 🔐 check owner
  if (item.email !== req.user.email) {
    return res.status(403).send({ message: "Forbidden" });
  }

  const result = await wishlistCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});
//===================ADD COMMENT==================
app.post("/comments", verifyToken, async (req, res) => {
  try {
    const comment = req.body;

    if (!comment.blogId || !comment.text) {
      return res.status(400).send({ message: "Missing fields" });
    }

    comment.email = req.user.email; // 🔐 secure
    comment.createdAt = new Date();

    const result = await commentCollection.insertOne(comment);

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to add comment" });
  }
});
//================GET COMMENTS BY BLOG ID=====================
app.get("/comments/:blogId", async (req, res) => {
  try {
    const blogId = req.params.blogId;

    const result = await commentCollection
      .find({ blogId: blogId })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch comments" });
  }
});
//================CREATE JWT ROUTE==============
app.post("/jwt", (req, res) => {
  const user = req.body;

  const token = jwt.sign(user, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.send({ token });
});

app.get("/blogs/search/:text", async (req, res) => {
  const text = req.params.text;

  const result = await blogCollection
    .find({ $text: { $search: text } })
    .toArray();

  res.send(result);
});

// ================= ROOT =================

app.get("/", (req, res) => {
  res.send("Server running");
});

app.listen(5000, () => console.log("Server running on port 5000"));


