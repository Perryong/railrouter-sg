# Restaurant Icon for RailRouter SG

You'll need to create a restaurant icon named `restaurant.png` to place in the `src` directory.

## Icon Specifications:
- Size: 24x24 pixels (preferred)
- Format: PNG with transparency
- Style: Should match the existing minimalist style of the application
- Color: Consider using a color that stands out but remains consistent with the app's color palette (teal or a complementary color)

## Implementation Steps:
1. Create or download a restaurant/food icon that is simple and recognizable
2. Save it as `restaurant.png` in the `src` directory
3. Make sure it's referenced correctly in the code (already implemented in index.js)

## Icon Example:
A simple plate with fork and knife or a restaurant/dining symbol would work well. Keep it minimal and recognizable at small sizes.

## Integration with Sprite Atlas:
The updated `gen-stations-sprite.js` script includes a reference to add this icon to the sprite atlas. If you plan to use the station sprite atlas for the restaurant icon (instead of a separate file), make sure to:

1. Add the icon to the `stations.png` file at position x:820, y:770 (or adjust these coordinates)
2. Run the updated sprite generation script to include it in `stations.json`
