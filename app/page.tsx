"use client";
import { useChat } from "ai/react";
import { Message } from "ai";

import Bubble from "@/components/Bubble"
import LoadingBubble from "@/components/LoadingBubble"


const Home = () => {
    const {append, isLoading, messages, input, handleInputChange, handleSubmit } = useChat();
    const noMessage = !messages || messages.length === 0;

    const handlePrompt = ( promptext) => {
        const msg: Message= {
            id: crypto.randomUUID(),
            content: promptext,
            role: "user"
        }
        append(msg)
    }
    return (
        <main>
            <h1>RAG Chatbot</h1>
            <section className={noMessage ? "": "populated"}>
                {noMessage ? (
                    <>
                        <p className="starter-text">
                            Hi! I'm RAG Chatbot. I can help you with your health problems. Ask me anything!
                        <br/>
                        </p>
                    </>
                ):(
                    <>
                        {messages.map((message, index) => <Bubble key={`message-${index}`} message={message}/>)}
                        {isLoading &&  <LoadingBubble/>}
                    </>
                )}


            </section>
            <form onSubmit={handleSubmit}>
                <input className="question-box" onChange={handleInputChange} value={input} placeholder="Ask me about your health problem" />
                <input type="submit" />
            </form>
        </main>
    );
};

export default Home;