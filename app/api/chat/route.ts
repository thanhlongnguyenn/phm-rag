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

const gpt = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)

const db = client.db(
    ASTRA_DB_API_ENDPOINT,
    {namespace: ASTRA_DB_NAMESPACE}
)

export async function POST(req: Request) {
    try {
        const {messages} = await req.json()
        const latestMessage = messages[messages?.length - 1]?.content

        let docContext = ""

        const embedding = await gpt.embeddings.create(
            {
                model: "text-embedding-3-small",
                input: latestMessage,
                encoding_format:"float"
            }
        )



        try {
            const collection = await db.collection(ASTRA_DB_COLLECTION)
            const cursor = collection.find(null, {
                sort: {
                    $vector: embedding.data[0].embedding
                },
                limit: 10
            })
            const documents = await cursor.toArray()

            const docsMap = documents?.map(doc => doc.text)

            docContext = JSON.stringify(docsMap)
        } catch (err) {
            console.log("error querying db")
            docContext = ""
        }

        const template = {
            role: "system",
            content: `You are an AI assistant who knows everything about diabetes. You are chatting with people that possibly have diabetes. Only use the below context to augment what you know about diabetes. The context will provide you with the most recent best practices in managing diabetes type 2. If the context does not have the information you need to answer, answer that you do not know the answer to the question. Only answer from the context provided. Only refer from the context provided. Format response using Markdown where applicable. Include references to the given context, formatted to minimal. Don't return images. Don't return links. Don't return code. Don't return personal information. Don't return profanity. Don't return hate speech. Don't return violence. Don't return misinformation. Don't return disinformation. Don't return spam. Don't include links.
            ----------------
            START OF CONTEXT
            ${docContext}
            END OF CONTEXT
            ----------------
            QUESTION: ${latestMessage}
            ----------------
            `
        }

        // const response = await openai.chat.completions.create({
        //     model: "gpt-4",
        //     stream: true,
        //     messages: [template, ...messages]
        // })
        //
        // const stream = toAIStreamResponse(response)

        const response = streamText({
            model: openai('gpt-4'),
            messages: [template, ...messages]
        })
        return response.toDataStreamResponse()


    } catch (err) {
        console.log("error querying db")
    }
}