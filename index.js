const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const database = client.db("redhope");
    const usersCollection = database.collection("user");
    console.log("Connected to MongoDB and accessed the 'user' collection");

    // User API
    app.get("/users", async (req, res) => {
      try {
        const cursor = usersCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send({ message: "Failed to fetch users", error: err.message });
      }
    });

    // Block / Unblock a user
    app.patch("/users/:id/status", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body; // "active" | "blocked"
        const { ObjectId } = require("mongodb");
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send({ message: `User status updated to ${status}` });
      } catch (err) {
        console.error("Error updating user status:", err);
        res.status(500).send({ message: "Failed to update user status", error: err.message });
      }
    });

    // Update user role
    app.patch("/users/:id/role", async (req, res) => {
      try {
        const { id } = req.params;
        const { role } = req.body; // "donor" | "volunteer" | "admin"
        const { ObjectId } = require("mongodb");
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send({ message: `User role updated to ${role}` });
      } catch (err) {
        console.error("Error updating user role:", err);
        res.status(500).send({ message: "Failed to update user role", error: err.message });
      }
    });

    // Root test route
    app.get("/", (req, res) => {
      res.send("Redhope server is running!");
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
