import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI();

export async function handler(event, context, callback) {
  
  const userInput = event.body;
  const request = {
     "model": "gpt-3.5-turbo-0301",
     "messages": [
         {
             "role": "system",
             "name": "assistant",
             "content": "Your primary task is to provide clear and concise steps to rectify specific accessibility violations based on the HTML and standards received. Additionally, highlight any potential pitfalls developers might encounter. Refrain from repeating yourself or asking the user for any followup. Tailor the advice to the standards and HTML snippet sent by the user."
         },
         {
             "role": "user", 
             "content": userInput
         }],
     "temperature": 0.7
   };
    
  try {
    const chatCompletion = await openai.chat.completions.create(request);
    console.log(chatCompletion);
    const completionText = chatCompletion.choices[0].message.content;

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: completionText,
      }),
    };

    callback(null, response);
  } catch (error) {
    const response = {
      statusCode: 500,
      body: JSON.stringify({
        message: "An error occurred",
      }),
    };
    
    console.log(response.choices.message)

    callback(error, response);
  }
}
