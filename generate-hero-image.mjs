import { OpenRouter } from "@openrouter/sdk";
import { writeFileSync } from "fs";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

const result = await openrouter.chat.send({
  model: "google/gemini-3-pro-image-preview",
  messages: [
    {
      role: "user",
      content: "Generate a beautiful, elegant cheesecake photograph for a bakery website hero image. The cheesecake should be light-colored (cream/vanilla) with colorful fresh fruit toppings like strawberries, blueberries, and raspberries. Soft, warm lighting. Clean white or light pastel background. Professional food photography style. High resolution, appetizing, luxurious presentation."
    }
  ],
  modalities: ["image", "text"]
});

const message = result.choices[0].message;
if (message.images && message.images.length > 0) {
  const imageUrl = message.images[0].image_url.url;
  
  // If it's a base64 data URL, save it as a file
  if (imageUrl.startsWith("data:image")) {
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    writeFileSync("public/hero-cheesecake.png", buffer);
    console.log("Saved to public/hero-cheesecake.png");
  } else {
    console.log("Image URL:", imageUrl);
  }
} else {
  console.log("No image generated. Response:", JSON.stringify(result, null, 2));
}
