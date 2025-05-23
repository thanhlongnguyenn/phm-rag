import OpenAI from "openai";
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY,
} = process.env;

const gpt = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);

const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (
      !body ||
      !body.messages ||
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Invalid request: messages array is required and must not be empty",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { messages, healthMetrics } = body;
    const latestMessage = messages[messages.length - 1]?.content;

    if (!latestMessage) {
      return new Response(
        JSON.stringify({
          error: "Invalid request: last message must have content",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    let docContext: string;
    let references: { id: string; text: string; docName: string }[] = [];

    const embedding = await gpt.embeddings.create({
      model: "text-embedding-3-small",
      input: latestMessage,
      encoding_format: "float",
    });

    try {
      const collection = await db.collection(ASTRA_DB_COLLECTION);
      const cursor = collection.find(null, {
        sort: {
          $vector: embedding.data[0].embedding,
        },
        limit: 10,
      });
      const documents = await cursor.toArray();

      const docsMap = documents?.map((doc) => ({
        id: doc._id.toString(),
        text: doc.text,
        vector: doc.$vector,
        docName: doc.docName || "Unknown Document",
      }));

      docContext = JSON.stringify(docsMap);
      references = docsMap.map((doc) => ({
        id: doc.id,
        text: doc.text,
        docName: doc.docName,
      }));

      console.log("\n=== References ===");
      references.forEach((ref) => {
        console.log(`\n[Ref: ${ref.id}] (${ref.docName})`);
        console.log(ref.text);
        console.log("-------------------");
      });
      console.log("===================\n");
    } catch (err) {
      console.log("Error querying DB:", err);
      docContext = "";
      references = [];
    }

    const healthMetricsText = healthMetrics
      ? `
### Patient Health Metrics
- Age: ${healthMetrics.age || "Not provided"}
- Gender: ${healthMetrics.gender || "Not provided"}
- Blood Sugar Level: ${
          healthMetrics.bloodSugar
            ? `${healthMetrics.bloodSugar} mmol/L`
            : "Not provided"
        }
`
      : "";

    const template = {
      role: "system",
      content: `### Context
        You are an Australian AI assistant specialized in building case studies for diabetes patients. You should use Australian documents for reference purposes. Only use the below context to augment what you know about diabetes. The context will provide you with the most recent best practices in managing diabetes type 2. If the context does not have the information you need, indicate that you do not have sufficient information. Format response using Markdown. Include references to the given context, formatted to minimal. Don't return images. Don't return links. Don't return code. Don't return personal information. Don't return profanity. Don't return hate speech. Don't return violence. Don't return misinformation. Don't return disinformation. Don't return spam. Don't include links.

        ${healthMetricsText}

        ### Instructions for Response
        1. Start your response by acknowledging the patient's health metrics and how they influence your recommendations.
        2. If blood sugar level is provided, interpret it (e.g., normal range, high, low) and explain its significance.
        3. Consider age and gender-specific factors in your recommendations.
        4. Provide personalized advice based on the provided metrics.
        5. Use the context to support your recommendations with evidence-based information.
        6. Format your response in clear sections with headers.
        7. End with a summary of key points and next steps.
        8. When referencing information from the context, use the format [Ref: ID] where ID is the document ID.

        ---

        ### Provided Context
        ${docContext}

        ---

        ### Question
        ${latestMessage}

        ---

        ### References
        ${references
          .map((ref) => `[${ref.id}] (${ref.docName}): ${ref.text}`)
          .join("\n")}
        `,
    };

    const completion = await gpt.chat.completions.create({
      model: "gpt-4",
      messages: [template, ...messages],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return new Response(
      JSON.stringify({
        content: completion.choices[0].message.content,
        references: references.map((ref) => ({
          id: ref.id,
          text: ref.text,
          docName: ref.docName,
        })),
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.log("Error processing request:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
