import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import OpenAI from "openai";

import "dotenv/config";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY,
} = process.env;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (similarityMetric: SimilarityMetric) => {
  const res = await db.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 1536,
      metric: similarityMetric,
    },
  });
  console.log(res);
};

const dataPath = "app/knowledgeBase";
const directoryLoader = new DirectoryLoader(dataPath, {
  ".pdf": (path: string) => new PDFLoader(path),
});

// const loadAllPDFs = async () => {
//   const docs = await directoryLoader.load();
//   // docs.forEach((doc, index) => {
//   //   console.log(`Document ${index + 1}:`, doc);
//   // });
//   console.log(docs[0])
// };
//
// loadAllPDFs();

const loadSampleData = async () => {
  const collection = db.collection(ASTRA_DB_COLLECTION); //create a new collection
  const docs = await directoryLoader.load();
  for await (const doc of docs) {
    const content = doc.pageContent;
    const chunks = await splitter.splitText(content); // into chunks
    const docName = doc.metadata?.source || "Unknown Document"; // Get document name from metadata
    for await (const chunk of chunks) {
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
        encoding_format: "float",
      });
      const vector = embedding.data[0].embedding;

      const res = await collection.insertOne({
        $vector: vector,
        text: chunk,
        docName: docName, // Store document name
      });
      console.log(res);
    }
  }
};

createCollection("dot_product").then(() => loadSampleData());
