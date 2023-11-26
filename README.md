### Setup Guide

To set up and run the application, follow these steps:

#### Step 1: Set up Environment Variables

1. **Configuration File**: Copy the provided `.env` file(in email) into the parent directory of the application. Ensure
   the environment variables in this file are correctly configured for PostgreSQL, RabbitMQ, and other necessary
   configurations.

#### Step 2: Install Dependencies

2. **Install Dependencies**: Open your terminal or command prompt, navigate to the application directory, and run the
   following command:
    ```bash
    npm install
    ```
   This will install all required dependencies defined in the `package.json` file.

#### Step 3: Start the Application

3. **Run the Application**: After installing dependencies, start the application using the following command:
    ```bash
    npm start
    ```
   This command will launch the server and start listening for incoming requests on the specified port.

#### Conclusion

After completing these steps, the application will be up and running, ready to handle data analysis requests through its
provided endpoints. Ensure the environment variables are correctly configured for PostgreSQL, RabbitMQ, and other
services as per the provided `.env` file.

*(Note: Ensure that Node.js is installed on your system before proceeding with these steps. Additionally, cloud-based
instances for PostgreSQL and RabbitMQ are already setup and integrated, eliminating the need for local
installations/setup.)*

# Infrastructure Overview

The application relies on a combination of cloud-based services and a Node.js runtime environment to handle data
processing, storage, and request handling.

## Components

1. **Node.js Runtime Environment**:

2. **PostgreSQL Database**:
    - Utilized as the primary data storage system, PostgreSQL is employed to persistently store post data and analysis
      results. 
    - It is used for assignment purpose only, in an ideal scenario, a NoSQL database would be more suitable
      for this application(cassandra making decision to optimise for AP(CAP)) .

3. **RabbitMQ**:
    - Employed as a message broker for queuing data analysis requests. RabbitMQ allows the application to manage
      incoming data asynchronously, ensuring scalability and reliable handling of large volumes of incoming requests.

4. **NodeCache**:
    - Utilized as an in-memory caching mechanism within the Node.js environment. NodeCache aids in temporarily storing
      post analysis results, significantly reducing computation overhead and optimizing data retrieval performance.
   - In real word scenario, we would be using distributed cache(redis, etc).

## Workflow

1. **Request Handling**:
    - The Node.js application receives incoming HTTP requests through defined endpoints, triggering various actions such
      as post creation, data analysis.

2. **Data Analysis**:
    - Upon receiving a request to create a post, the application enqueues the post data to RabbitMQ for asynchronous
      processing. The processing includes calculating word count and average word length for each post.

3. **Data Storage**:
    - Post data and analysis results are persistently stored in the PostgreSQL database. This allows for efficient
      retrieval of post information and analysis results when requested by the application's endpoints.

4. **Caching Strategy**:
    - NodeCache is employed to cache post analysis results temporarily. This strategy significantly enhances the
      application's performance by reducing repeated computations for frequently accessed data.

#### cURL for Creating a Post

```bash
curl -X POST \
  http://localhost:3005/api/posts \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "1155ce15-0583-4cd8-9273-a8babaa897b3",
    "text": "Altman just got fired from OpenAI"
}'
```


#### cURL for getting a Post

```bash
curl --location 'http://localhost:3005/api/posts/1155ce15-0583-4cd8-9273-a8babaa897b2'

```

Decisions and Assumptions

1 **Async or sync analysis**:
   - Assuming Social media posts analysis need not to be done in sync, and at a single time ton of new posts would be coming
      so we can use async analysis for better performance and reducing load on server.

2 **Soring analysis result in db itself**:
    - Assuming in a very rare case post would be edited further changing analysis result, so we have precomputed
      analysis result and stored in db itself.

3 **Caching**:
    - Assuming post analysis result would be frequently accessed, so we are caching it in memory




