const sharp = require('sharp');
const path = require('path');

async function createCircularFavicon() {
  const inputPath = path.join(__dirname, '../public/notext.png');
  const outputPath = path.join(__dirname, '../public/favicon.png');

  const circleSize = 128;
  const padding = 20; // Add padding so logo isn't cut off
  const logoSize = circleSize - (padding * 2); // Logo will be smaller to fit with padding

  // Create circular mask
  const circleMask = Buffer.from(
    `<svg width="${circleSize}" height="${circleSize}">
      <circle cx="${circleSize/2}" cy="${circleSize/2}" r="${circleSize/2}" fill="white"/>
    </svg>`
  );

  // Resize logo smaller first
  const resizedLogo = await sharp(inputPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Create base with padding and composite the logo centered
  await sharp({
    create: {
      width: circleSize,
      height: circleSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
    }
  })
    .composite([
      {
        input: resizedLogo,
        left: padding,
        top: padding
      },
      {
        input: circleMask,
        blend: 'dest-in'
      }
    ])
    .png()
    .toFile(outputPath);

  console.log('Created circular favicon at:', outputPath);
}

createCircularFavicon().catch(console.error);
