import { OpenRouter } from "@openrouter/sdk";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});

// Product image prompts - professional food photography style
const products = [
  {
    filename: "lemon-blueberry-crumb-cheesecake.jpg",
    prompt: "Professional food photography of a luxurious lemon blueberry crumb cheesecake on a white marble surface. The cheesecake has a golden crumb topping, creamy yellow interior with visible blueberries, and fresh blueberries cascading down the side. Soft natural window lighting, shallow depth of field, 4K ultra sharp, appetizing and elegant presentation, premium bakery quality"
  },
  {
    filename: "cookie-butter-cheesecake.jpg",
    prompt: "Professional food photography of a decadent cookie butter cheesecake with caramelized Biscoff cookies on top. Rich amber-colored swirls throughout the creamy filling, graham cracker crust visible. Drizzled with cookie butter sauce. Styled on dark wood board with scattered Biscoff cookies. Warm golden lighting, 4K resolution, mouthwatering bakery presentation"
  },
  {
    filename: "vanilla-bean-cheesecake.jpg",
    prompt: "Professional food photography of a classic New York style vanilla bean cheesecake. Perfectly smooth creamy white surface with visible Madagascar vanilla bean specks throughout. Golden brown top, buttery graham cracker crust. Elegant plating on ceramic plate with a vanilla bean pod garnish. Soft studio lighting, 4K ultra sharp, premium dessert photography"
  },
  {
    filename: "strawberry-swirl-cheesecake.jpg",
    prompt: "Professional food photography of a stunning strawberry swirl cheesecake. Beautiful pink strawberry puree artistically swirled through creamy white cheesecake. Fresh glazed strawberries on top. Graham cracker crust base. Served on white cake stand with scattered fresh strawberries. Bright natural lighting, 4K resolution, luxurious bakery presentation"
  },
  {
    filename: "heart-cake-6inch.jpg",
    prompt: "Professional food photography of an elegant 6-inch heart-shaped custom cake for Valentine's Day or anniversaries. Smooth pink ombre buttercream frosting, delicate white piped roses on top, edible gold leaf accents. Romantic presentation on white marble surface with rose petals scattered around. Soft romantic lighting, 4K ultra sharp, luxury bakery quality"
  },
  {
    filename: "venus-cake-5inch.jpg",
    prompt: "Professional food photography of an exquisite 5-inch Venus Et Fleur inspired cake. Covered in realistic buttercream roses in blush pink and ivory tones arranged like an eternal rose box. Elegant gold cake board. Luxurious presentation on marble with soft pink fabric. Glamorous soft lighting, 4K resolution, high-end custom bakery style"
  },
  {
    filename: "custom-cake-7inch.jpg",
    prompt: "Professional food photography of a beautiful 7-inch two-tier custom celebration cake. Smooth white fondant with elegant gold hand-painted details, fresh flowers cascading down one side, modern minimalist design. On a gold cake stand against neutral backdrop. Bright studio lighting, 4K ultra sharp, premium custom bakery presentation"
  },
  {
    filename: "custom-cake-9inch.jpg",
    prompt: "Professional food photography of a stunning 9-inch three-tier custom wedding style cake. Elegant white buttercream with textured ruffles, delicate sugar flowers, and gold accents. Impressive height and presence. Professional cake stand, soft fabric draping in background. Magazine quality lighting, 4K resolution, luxury celebration cake"
  },
  {
    filename: "vegan-cake-7inch.jpg",
    prompt: "Professional food photography of a gorgeous 7-inch vegan custom cake. Rich chocolate layers visible from a cut slice, silky vegan chocolate ganache coating, fresh berries and edible flowers on top. Modern rustic presentation on wooden cake stand with greenery accents. Natural lighting, 4K ultra sharp, artisan vegan bakery style"
  },
  {
    filename: "vegan-chocolate-cupcakes.jpg",
    prompt: "Professional food photography of a beautiful arrangement of 6 vegan chocolate cupcakes. Rich dark chocolate cake with fluffy dairy-free chocolate buttercream swirled high. Topped with chocolate shavings and cocoa powder dusting. Displayed on tiered cupcake stand. Warm inviting lighting, 4K resolution, gourmet vegan bakery presentation"
  },
  {
    filename: "red-velvet-cupcakes.jpg",
    prompt: "Professional food photography of 6 classic red velvet cupcakes with towering cream cheese frosting swirls. Deep red velvet color visible, white frosting piped in elegant rosettes, red velvet crumb garnish on top. Arranged on white serving plate. Bright cheerful lighting, 4K ultra sharp, premium bakery quality"
  },
  {
    filename: "cupcake-board-12.jpg",
    prompt: "Professional food photography of a stunning cupcake board with 12 assorted gourmet cupcakes. Variety of flavors - chocolate, vanilla, red velvet, lemon, salted caramel - each with unique colorful frosting designs. Arranged artistically on large wooden board with fresh flowers and greenery. Overhead flat lay shot, 4K resolution, Instagram-worthy presentation"
  },
  {
    filename: "classic-pound-cake.jpg",
    prompt: "Professional food photography of a traditional homestyle pound cake. Dense golden crumb visible from a cut slice, beautiful crack on top showing perfect rise. Dusted with powdered sugar. Served on vintage cake plate with butter knife and coffee cup in background. Warm nostalgic lighting, 4K ultra sharp, comfort food bakery style"
  },
  {
    filename: "lemon-pound-cake.jpg",
    prompt: "Professional food photography of a glazed lemon pound cake. Bright white lemon glaze dripping down the sides, visible lemon zest specks in the golden cake, fresh lemon slices as garnish. Bundt cake shape on ceramic plate with fresh lemons nearby. Bright citrusy lighting, 4K resolution, fresh artisan bakery presentation"
  }
];

async function generateImages() {
  const outputDir = path.join(process.cwd(), "public", "products");
  
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  console.log(`Generating ${products.length} product images...\n`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`[${i + 1}/${products.length}] Generating: ${product.filename}`);
    
    try {
      const result = await openrouter.chat.send({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: product.prompt
          }
        ],
        modalities: ["image", "text"]
      });

      const message = result.choices[0].message;
      
      if (message.images && message.images.length > 0) {
        const imageData = message.images[0].image_url.url;
        
        // Extract base64 data from data URL
        const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
        if (base64Match) {
          const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
          const buffer = Buffer.from(base64Match[2], "base64");
          const outputPath = path.join(outputDir, product.filename.replace(/\.jpg$/, `.${ext}`));
          await writeFile(outputPath, buffer);
          console.log(`   ✓ Saved: ${outputPath}`);
        } else {
          console.log(`   ✗ Unexpected image format`);
        }
      } else {
        console.log(`   ✗ No image generated`);
        if (message.content) {
          console.log(`   Response: ${String(message.content).substring(0, 100)}...`);
        }
      }
    } catch (error) {
      console.error(`   ✗ Error: ${error.message}`);
    }
    
    // Rate limiting - wait between requests
    if (i < products.length - 1) {
      console.log("   Waiting 3s...");
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log("\nImage generation complete!");
}

generateImages().catch(console.error);
