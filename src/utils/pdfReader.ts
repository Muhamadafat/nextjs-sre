import fs from 'fs';
import pdfParse from 'pdf-parse';

export async function readPDFContent(buffer: Buffer): Promise<string>{
    try {        
        const data = await pdfParse(buffer);
        return data.text;
    } catch (error: any) {
        console.error("error reading PDF content", error?.message);
        throw error;
    }
};