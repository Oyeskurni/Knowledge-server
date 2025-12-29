const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cdpfqv1.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const articlesCollection = client.db('articles').collection('article');
    const commentsCollection = client.db('articles').collection('article_comments');

    app.get('/articles', async (req, res) => {
      const cursor = articlesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/articles/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await articlesCollection.findOne(query);
      res.send(result);
    })

    app.get('/articles', async (req, res) => {
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


    app.post('/comments', async (req, res) => {
      const comment = req.body;
      console.log(comment);
      const result = await commentsCollection.insertOne(comment);
      res.send(result);
    })

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