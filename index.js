const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");

// Middlewares
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// firebase-admin
var admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_API_KEY, ('base64')).toString('utf8');
var serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cdpfqv1.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(403).send({ message: "Forbidden" });
  }
};


const verifyEmail = (req, res, next) => {
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: 'forbidden access' });
  }
  next();
}
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const articlesCollection = client.db('articles').collection('article');
    const commentsCollection = client.db('articles').collection('article_comments');
    const bookmarksCollection = client.db('articles').collection('bookmarks');

    app.post("/jwt", async (req, res) => {
      const { email } = req.body;

      // ✅ payload MUST be an object
      const token = jwt.sign(
        { email },                     // 👈 FIXED
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // 🔐 cookie হিসেবে পাঠানো (best practice)
      res.cookie("token", token, {
        httpOnly: true,
        secure: false, // production হলে true
        sameSite: "lax"
      });

      res.send({ success: true });
    });



    // ===============================
// GET ALL ARTICLES WITH FILTER
// ===============================
app.get('/articles', async (req, res) => {

  // 🔽 FILTER PARAMETERS
  const { category, tag } = req.query;

  let query = {};

  //  CATEGORY FILTER
  if (category) {
    query.category = category;
  }

  //  TAG FILTER (array field)
  if (tag) {
    query.tags = { $in: [tag] };
  }

  //  SORT: Latest first
  const result = await articlesCollection
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  res.send(result);
});


    app.get('/articles/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await articlesCollection.findOne(query);
      res.send(result);
    })

    app.get('/my-articles', verifyFirebaseToken,verifyEmail, async (req, res) => {
      const email = req.query.email;
      const query = { user_email: email };
      const result = await articlesCollection.find(query).toArray();
      res.send(result);
    })
    app.post('/articles', async (req, res) => {
      const article = req.body;
      const newArticle = {
        ...article,
        likes: [],
        likesCount: 0,
        createdAt: new Date()
      };
      const result = await articlesCollection.insertOne(newArticle);
      res.send(result);
    })

    app.delete('/articles/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await articlesCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/articles/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const article = req.body;
      const updateDoc = { $set: article };
      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result);
    })
    app.patch('/articles/like/:id', async (req, res) => {
      const articleId = req.params.id;
      const { userId } = req.body;

      const query = { _id: new ObjectId(articleId) };
      const article = await articlesCollection.findOne(query);

      if (!article) {
        return res.status(404).send({ message: "Article not found" });
      }

      let updateDoc;

      if (article.likes.includes(userId)) {
        // UNLIKE
        updateDoc = {
          $pull: { likes: userId },
          $inc: { likesCount: -1 }
        };
      } else {
        // LIKE
        updateDoc = {
          $addToSet: { likes: userId },
          $inc: { likesCount: 1 }
        };
      }

      const result = await articlesCollection.updateOne(query, updateDoc);
      res.send(result);
    });


    // app.post('/comments', async (req, res) => {
    //   const commentData = {
    //     content: req.body.content,
    //     user_name: req.body.user_name,
    //     user_email: req.body.user_email,
    //     user_photo: req.body.user_photo,
    //     articleId: new ObjectId(req.body.articleId),
    //     createdAt: new Date()
    //   };
    //   const result = await commentsCollection.insertOne(commentData);
    //   res.send(result);
    // });

    app.post('/comments', async (req, res) => {
      const { articleId } = req.body;

      await commentsCollection.insertOne({
        ...req.body,
        articleId: new ObjectId(articleId),
        createdAt: new Date()
      });

      await articlesCollection.updateOne(
        { _id: new ObjectId(articleId) },
        { $inc: { commentCount: 1 } }
      );

      res.send({ success: true });
    });



    app.get('/comments', async (req, res) => {
      const { articleId } = req.query;

      let query = {};

      if (articleId) {
        query = { articleId: new ObjectId(articleId) };
      }

      const result = await commentsCollection.find(query).toArray();
      res.send(result);
    });


    app.get('/comments/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await commentsCollection.findOne(query);
      res.send(result);
    })


    app.patch('/comments/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const comment = req.body;
      const updateDoc = { $set: comment };
      const result = await commentsCollection.updateOne(query, updateDoc);
      res.send(result);
    })


    app.delete('/comments/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await commentsCollection.deleteOne(query);
      res.send(result);
    })

    app.post('/bookmarks', async (req, res) => {
      const { articleId, user_email } = req.body;

      const query = { articleId: new ObjectId(articleId), user_email };

      const exists = await bookmarksCollection.findOne(query);

      if (exists) {
        await bookmarksCollection.deleteOne(query);
        return res.send({ bookmarked: false });
      }

      await bookmarksCollection.insertOne({
        ...query,
        createdAt: new Date()
      });

      res.send({ bookmarked: true });
    });


    app.get('/my-bookmarks', async (req, res) => {
      const { user_email } = req.query;

      const bookmarks = await bookmarksCollection.find({ user_email }).toArray();

      const articleIds = bookmarks.map(b => b.articleId);

      const articles = await articlesCollection
        .find({ _id: { $in: articleIds } })
        .toArray();

      res.send(articles);
    });

    app.get('/bookmarks/check', async (req, res) => {
      const { articleId, user_email } = req.query;

      const exists = await bookmarksCollection.findOne({
        articleId: new ObjectId(articleId),
        user_email
      });

      res.send({ bookmarked: !!exists });
    });

    app.delete('/my-bookmarks/:articleId', async (req, res) => {
      try {
        const { articleId } = req.params;
        const { user_email } = req.query;

        if (!user_email) {
          return res.status(400).send({ message: "user_email is required" });
        }

        const result = await bookmarksCollection.deleteOne({
          user_email,
          articleId: new ObjectId(articleId)
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Bookmark not found" });
        }

        res.send({
          success: true,
          message: "Bookmark deleted successfully"
        });

      } catch (error) {
        res.status(500).send({ message: "Server error", error });
      }
    });





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello from server');
})

app.listen(port, () => {
  console.log('Listening to port', port);
})
