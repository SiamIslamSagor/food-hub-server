const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookeParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: [
      "https://food-hub-6f2e6.web.app",
      "https://food-hub-6f2e6.firebaseapp.com",
    ],
    credentials: true,
  })
);

// to read cookie data
app.use(cookeParser());
// to gate data in body
app.use(express.json());

console.log(process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e9we0w0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// my own created middleware:
// //////////////////////
const logger = async (req, res, next) => {
  console.log("callllled: ", req.host, req.originalUrl);
  next();
};

// token verify middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("value of token in middleware", token);
  // if token not exist , then run this codeblock
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  //  if token exist then , verify the token in this code block
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    // if token have any problem, then run this codeblock
    if (error) {
      console.log(error);
      return res.status(401).send({ message: "unauthorized access" });
    }
    // if token have no problem, then run this codeblock
    console.log("value in the token in decode:++++>", decoded);
    req.user = decoded;
    next();
  });
};

// //////////////////////

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    ///////////////////////////////////////////////

    // database and collection
    const foodsCollection = client
      .db("foodHubDB")
      .collection("foodsCollection");

    const foodRequestCollection = client
      .db("foodHubDB")
      .collection("foodRequestCollection");

    const addedFoodsCollection = client
      .db("foodHubDB")
      .collection("addedFoodsCollection");

    // jwt auth api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(user);

      //  generate a new cookie token
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      // set token in cookie
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // when called the api , then clear the cookie
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ success: true });
    });

    // read: get all foods
    app.get("/", async (req, res) => {
      const result = await foodsCollection.find().toArray();
      res.send(result);
    });

    // create: insert food in added foods collection
    app.post("/added_foods", async (req, res) => {
      const data = req.body;
      const result = await addedFoodsCollection.insertOne(data);
      res.send(result);
    });

    // create: insert food in  foods collection
    app.post("/available_foods/add", async (req, res) => {
      const data = req.body;
      const result = await foodsCollection.insertOne(data);
      res.send(result);
    });

    // create: insert food in  foods request collection
    app.post("/requestCollection", async (req, res) => {
      const data = req.body;
      const result = await foodRequestCollection.insertOne(data);
      res.send(result);
    });

    // read: get single food
    app.get("/added_food_find/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addedFoodsCollection.findOne(query);
      res.send(result);
    });

    // delete: to delete single food form foodsCollection

    // read: filter added food by current user in added foods collection
    app.get("/added_Food", verifyToken, async (req, res) => {
      console.log("REQUEST EMAIL QUERY", req.query.email);
      console.log("VALUE OF DECODED TOKEN===:::>>", req.user);
      /////////////////////////
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      /////////////////////////
      let query = {};
      if (req.query.email) {
        query = {
          donarEmail: req.query.email,
        };
      }
      const result = await addedFoodsCollection.find(query).toArray();
      res.send(result);
    });

    // read: find single food in added food
    app.get("/get_added_Food/:id", async (req, res) => {
      const manageFoodId = req.params.id;
      const query = { _id: new ObjectId(manageFoodId) };
      const result = await addedFoodsCollection.findOne(query);
      res.send(result);
    });

    // read: find single food in foodsCollection
    app.get("/get_food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.findOne(query);
      res.send(result);
    });

    // update: update food info in database added food collection
    app.patch("/update_food/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = {
        $set: {
          foodImg: updatedData.foodImg,
          foodName: updatedData.foodName,
          foodQuantity: updatedData.foodQuantity,
          expiredDate: updatedData.expiredDate,
          additionalNotes: updatedData.additionalNotes,
          pickupLocation: updatedData.pickupLocation,
        },
      };
      const result = await addedFoodsCollection.updateOne(
        filter,
        updatedFood,
        options
      );
      res.send(result);
    });

    // update: update food info in database added food collection
    app.patch(
      "/update_food_in_foodsCollection/:hexString",
      async (req, res) => {
        const updatedHexString = req.params.hexString;
        const updatedData = req.body;
        const filter = { hexString: updatedHexString };
        const options = { upsert: true };
        const updatedFood = {
          $set: {
            foodImg: updatedData.foodImg,
            foodName: updatedData.foodName,
            foodQuantity: updatedData.foodQuantity,
            expiredDate: updatedData.expiredDate,
            additionalNotes: updatedData.additionalNotes,
            pickupLocation: updatedData.pickupLocation,
          },
        };
        const result = await foodsCollection.updateOne(
          filter,
          updatedFood,
          options
        );
        res.send(result);
      }
    );
    ///////////////////////////////////==
    // delete api
    ///////////////////////////////////===
    // delete: to delete a single food in database added foods collection
    app.delete("/delete_food/:id", async (req, res) => {
      const id = req.params.id;
      console.log("DELET THIS ID", id);
      const query = { _id: new ObjectId(id) };
      const result = await addedFoodsCollection.deleteOne(query);
      res.send(result);
    });
    ///////////////////////////////////==
    ///////////////////////////////////===
    // delete: delete added food form foods collection by using hexCode identifier
    app.delete("/delete_added_food/:hexString", async (req, res) => {
      const DeleteFoodHexString = req.params.hexString;
      const query = { hexString: DeleteFoodHexString };
      const result = await foodsCollection.deleteOne(query);
      res.send(result);
    });

    // create: create request data and save in database
    app.post("/requestCollection", async (req, res) => {
      const data = req.body;
      const result = await foodRequestCollection.insertOne(data);
      res.send(result);
    });

    // read: to read single request food in database
    app.get("/requested_food/:id", async (req, res) => {
      const requestedFoodId = req.params.id;
      const query = { _id: new ObjectId(requestedFoodId) };
      const result = await addedFoodsCollection.findOne(query);
      res.send(result);
    });
    /////////////////////////////
    // read: to read specific food all request in database
    app.get("/get_requested_people/:hexString", async (req, res) => {
      const requestedFoodHexString = req.params.hexString;
      const query = { hexString: requestedFoodHexString };
      const result = await foodRequestCollection.find(query).toArray();
      res.send(result);
    });

    //////////////////////////////
    // read: filter added food by current user in added foods collection
    app.get("/my_all_request", verifyToken, logger, async (req, res) => {
      console.log("REQUEST EMAIL QUERY", req.query.email);
      console.log("VALUE OF DECODED TOKEN===:::>>", req.user);
      /////////////////////////
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      /////////////////////////

      let query = {};
      if (req.query.email) {
        query = {
          requesterEmail: req.query.email,
        };
      }
      const result = await foodRequestCollection.find(query).toArray();
      res.send(result);
    });

    // update: to update food status request collection
    app.patch("/food_status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = {
        $set: {
          foodStatus: "Delivered",
        },
      };
      const result = await foodRequestCollection.updateOne(
        filter,
        updatedFood,
        options
      );
      res.send(result);
    });

    ///////
    app.delete("/delete_request/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodRequestCollection.deleteOne(query);
      res.send(result);
    });

    //////////////////////////////
    app.patch(
      "/change_status_added_foodCollection/:hexString",
      async (req, res) => {
        const requestedHexString = req.params.hexString;
        const filter = { hexString: requestedHexString };
        const options = { upsert: true };
        const updatedFood = {
          $set: {
            foodStatus: "Delivered",
          },
        };
        const result = await addedFoodsCollection.updateOne(
          filter,
          updatedFood,
          options
        );
        res.send(result);
      }
    );

    // Delete: to update food status added foods collection
    app.delete("/delete_food_in_foodCollection/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.deleteOne(query);
      res.send(result);
    });
    ///////////////////////////////////////////////
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`FOODHUB SERVER IS RUNNING ON PORT ${port}`);
});
