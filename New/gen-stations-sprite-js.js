const fs = require('fs');
const sprite = require('./sprite.json');

const { data } = sprite;

// Add restaurant sprite to the data array if it doesn't exist
const hasRestaurantSprite = data.some(item => item.sprite === 'restaurant-svg');

if (!hasRestaurantSprite) {
  // Add restaurant sprite at the end of the data array
  // These coordinates need to be adjusted based on the actual position in the sprite image
  // The restaurant icon should be added to stations.png at the position specified here
  data.push({
    sprite: 'restaurant-svg',
    w: 20,
    h: 20,
    x: 820,  // X coordinate in the sprite image
    y: 770   // Y coordinate in the sprite image
  });
}

const output = data.map((d) => {
  const { sprite, w, h, x, y } = d;
  return [sprite.replace(/\-svg$/i, ''), x, y, w, h];
});

fs.writeFileSync('src/stations.json', JSON.stringify(output, null, '\t'));
