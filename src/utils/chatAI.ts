import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
})

export const chatAI = async (text: string) => {
    try {
        const result = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: text,
        });
        if(!result){
            throw new Error('There is no result for chatting AI');
        };
        const answer = result.candidates?.[0].content?.parts?.[0]?.text ?? "Tidak ada jawaban";
        
        return answer;
    } catch (error) {
        console.error('error :', error);
    }
}