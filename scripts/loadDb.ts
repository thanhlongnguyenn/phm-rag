import {DataAPIClient} from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter"
import OpenAI from "openai"

import "dotenv/config"