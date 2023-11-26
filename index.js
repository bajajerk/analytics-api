// Import required modules
const dotenv = require('dotenv');
const { Pool } = require('pg');
const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const NodeCache = require('node-cache');

// Load environment variables from .env file
dotenv.config({ path: './.env' });

// Create Express application
const app = express();
app.use(bodyParser.json());

// Set port for the API server
const port = process.env.API_PORT || 3000;

// Initialize PostgreSQL database connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Initialize request rate-limiting parameters from environment variables or defaults
const requestCache = new NodeCache();
const windowMs = process.env.WINDOW_MS || 60000; // 1 minute window (default value: 60000)
const maxRequests = process.env.MAX_REQUESTS || 100; // Maximum requests per windowMs (default value: 100)
const delayMs = process.env.DELAY_MS || 1000; // Delay in milliseconds before allowing additional requests (default value: 1000)

// Middleware for IP-based rate limiting
const rateLimit = (req, res, next) => {
    const clientIP = req.ip; // Get the client's IP address

    // Create a unique cache key for the client's IP address
    const cacheKey = `rateLimit-${clientIP}`;

    // Check if IP exists in cache and perform rate limiting logic
    if (requestCache.has(cacheKey)) {
        const count = requestCache.get(cacheKey);
        if (count >= maxRequests) {
            return res.status(429).json({ error: 'Too many requests' });
        } else {
            requestCache.set(cacheKey, count + 1, windowMs);
        }
    } else {
        requestCache.set(cacheKey, 1, windowMs);
    }

    setTimeout(() => {
        // Decrease the request count after delayMs
        const currentCount = requestCache.get(cacheKey);
        if (currentCount === 1) {
            requestCache.del(cacheKey);
        } else {
            requestCache.set(cacheKey, currentCount - 1, windowMs);
        }
    }, delayMs);

    next();
};

// Apply rate limiting middleware to all routes
app.use(rateLimit);

// Establish connection to RabbitMQ server
const mqServer = process.env.MQ_SERVER;
let channel, queueName = 'postAnalysisQueue';
const postCache = new NodeCache();

amqp.connect(mqServer)
    .then(connection => {
        return connection.createChannel();
    })
    .then(ch => {
        channel = ch;
        return channel.assertQueue(queueName, { durable: true });
    })
    .then(() => {
        // Consume messages from the queue
        channel.consume(queueName, processMessage, { noAck: false });

        // Start the server after the connection is established
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch(err => console.error('Error connecting to RabbitMQ:', err));

// Endpoint for creating posts
app.post('/api/posts', async (req, res) => {
    const { id, text } = req.body;

    try {

        // Publish a message to the queue for analysis (with the post ID and text) which would happen in async
        channel.sendToQueue(queueName, Buffer.from(JSON.stringify({ id, text })), { persistent: true });

        res.status(201).json({ message: 'Post enqueues successfully' });
    } catch (error) {
        console.log('Failed to enqueue post:', error)
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Endpoint for getting post analysis with caching
app.get('/api/posts/:id', async (req, res) => {
    const postId = req.params.id;

    try {
        // Check if post analysis exists in the cache
        const cachedAnalysis = postCache.get(postId);
        if (cachedAnalysis) {
            res.status(200).json({ post: cachedAnalysis })
        } else {
            // Fetch post text from the database using the post ID
            const result = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);

            if (result.rows.length) {
                const post = result.rows[0];

                // Cache the analysis result with a TTL (time-to-live) of 60 seconds
                postCache.set(postId, post, 60);

                res.status(200).json({ post });
            } else {
                res.status(404).json({ error: 'Post not found' });
            }
        }
    } catch (error) {
        console.error('Failed to fetch post or perform analysis:', error);
        res.status(500).json({ error: 'Failed to fetch post or perform analysis' });
    }
});

// Function to process messages from the queue
const processMessage = async (msg) => {
    const { id, text } = JSON.parse(msg.content.toString())

    // Fetch post text from the database
    try {
        const words = text.split(/\s+/);

        // Calculate the number of words
        const wordCount = words.length;

        // Calculate the total length of all words
        const totalWordLength = words.reduce((total, word) => total + word.length, 0);

        // Calculate the average word length
        const averageWordLength = wordCount > 0 ? Math.round(totalWordLength / wordCount) : 0;

        // Save analysis to the database
        await pool.query('INSERT INTO posts (id, text, totalWordLength, averageWordLength ) ' +
            'VALUES ($1, $2, $3, $4)', [id, text, wordCount, averageWordLength]);

        console.log(`Post ${id} analysis completed:`, { wordCount, averageWordLength });
        channel.ack(msg);
    } catch (error) {
        console.error('Failed to process message:', error);
        // Reject message (requeue it)
        channel.reject(msg, true);
    }
};

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
