// import OpenAI from "openai";
// import {createOpenAI} from "@ai-sdk/openai";
import OpenAI from "openai"
import {streamText} from "ai";
import {DataAPIClient} from "@datastax/astra-db-ts";
import {openai} from "@ai-sdk/openai";


const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    OPENAI_API_KEY
} = process.env;

const gpt = new OpenAI({apiKey: OPENAI_API_KEY});

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)

const db = client.db(
    ASTRA_DB_API_ENDPOINT,
    {namespace: ASTRA_DB_NAMESPACE}
)

export async function POST(req: Request) {
    try {
        const {messages} = await req.json();
        const latestMessage = messages[messages?.length - 1]?.content;

        let docContext: string;
        let references: string;

        const embedding = await gpt.embeddings.create({
            model: "text-embedding-3-small",
            input: latestMessage,
            encoding_format: "float"
        });

        try {
            const collection = await db.collection(ASTRA_DB_COLLECTION);
            const cursor = collection.find(null, {
                sort: {
                    $vector: embedding.data[0].embedding
                },
                limit: 10
            });
            const documents = await cursor.toArray();

            // Map the documents to include _id, text, and $vector
            const docsMap = documents?.map(doc => ({
                id: doc._id,
                text: doc.text,
                vector: doc.$vector,
            }));

            // Log references to the console
            console.log("References:");
            docsMap.forEach(doc => {
                console.log(`ID: ${doc.id}`);
                console.log(`Vector: ${(doc.vector)}`);
                console.log(`Text: ${doc.text}`);
                console.log("-------------");
            });

            docContext = JSON.stringify(docsMap);
            references = "References logged to console.";
        } catch (err) {
            console.log("Error querying DB:", err);
            docContext = "";
            references = "Cannot find any relevant documents.";
        }

        const template = {
            role: "system",
            content: `### Context
        You are an Australian AI assistant who knows everything about diabetes. You are chatting with people that possibly have diabetes. You should use Australian documents for reference purposes. Only use the below context to augment what you know about diabetes. The context will provide you with the most recent best practices in managing diabetes type 2. If the context does not have the information you need to answer, answer that you do not know the answer to the question. Only answer from the context provided. Only refer from the context provided. Format response using Markdown where applicable. Include references to the given context, formatted to minimal. Don't return images. Don't return links. Don't return code. Don't return personal information. Don't return profanity. Don't return hate speech. Don't return violence. Don't return misinformation. Don't return disinformation. Don't return spam. Don't include links.

        ---

        ### Provided Context
        ${docContext}

        ---

        ### Question
        ${latestMessage}

        ---

        ### References
        ${references}
        `
        };

        const response = streamText({
            model: openai('gpt-4'),
            messages: [template, ...messages]
        });
        return response.toDataStreamResponse();
    } catch (err) {
        console.log("Error processing request:", err);
    }
}