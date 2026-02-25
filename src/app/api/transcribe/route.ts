import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Convert File to Buffer
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a temporary file
    const tempFilePath = path.join('/tmp', `audio-${Date.now()}.webm`);
    fs.writeFileSync(tempFilePath, buffer);

    // Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    // Organize into tasks using GPT
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a task organizer. Take a messy transcript and organize it into a structured task list.
          
          Return a JSON object with this structure:
          {
            "urgent": ["task 1", "task 2"],
            "later": ["task 3", "task 4"]
          }
          
          Categorize tasks as "urgent" if they are time-sensitive or high priority, otherwise put them in "later".`
        },
        {
          role: 'user',
          content: `Transcript: "${transcription.text}"\n\nOrganize this into urgent and later tasks. Return JSON only.`
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    try {
      const tasks = JSON.parse(content);
      return NextResponse.json(tasks);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
