// https://github.com/parcel-bundler/parcel/issues/3375#issuecomment-599160200
import 'regenerator-runtime/runtime';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const $ = (id) => document.getElementById(id);
const $home = $('home');
const $btnCloseHome = $('btn-close-home');
const $station = $('station');
const $search = $('search');
const $searchField = $('search-field');
const $searchCancel = $('search-cancel');
const $searchResults = $('search-results');
const $crowdedTiming = $('crowded-timing');
const $foodFinder = $('food-finder');
const $toggleFoodFinder = $('toggle-food-finder');
const $stationSelect = $('station-select');
const $findRestaurants = $('find-restaurants');
const $useMyLocation = $('use-my-location');
const $foodFinderResults = $('food-finder-results');

$btnCloseHome.onclick = (e) => {
  e.preventDefault();
  localStorage['railrouter-sg:about'] = 1;
  $home.classList.remove('open');
};
if (!localStorage['railrouter-sg:about']) {
  $home.classList.add('open');
}
$('logo').onclick = () => {
  $home.classList.toggle('open');
};

import Fuse from 'fuse.js';
let fuse;

let stationsData;
const exitsData = {};

const geojsonFetch = fetch(require('./sg-rail.geo.json'));

import mapboxgl from 'mapbox-gl';
import MapboxLanguage from '@mapbox/mapbox-gl-language';
import stationsSprite from './stations.json';
mapboxgl.accessToken =
  'pk.eyJ1IjoiY2hlZWF1biIsImEiOiJja2NydG83cWMwaGJsMnBqdjR5aHc3MzdlIn0.YGTZpi7JQMquEOv9E8K_bg';

const center = [103.8475, 1.3011];
const lowerLat = 1.23,
  upperLat = 1.475,
  lowerLong = 103.59,
  upperLong = 104.05;
const bounds = [lowerLong, lowerLat, upperLong, upperLat];

mapboxgl.setRTLTextPlugin(
    "https://wipfli.github.io/maplibre-gl-complex-text/dist/maplibre-gl-complex-text.js",
    false
);

const map = (window.$map = new mapboxgl.Map({
  container: 'map',
  // style: 'mapbox://styles/cheeaun/clagddy23000y14saafbh02a8/draft',
  style: 'mapbox://styles/cheeaun/clagddy23000y14saafbh02a8',
  center,
  bounds,
  renderWorldCopies: false,
  boxZoom: false,
  bearingSnap: 15,
  // localIdeographFontFamily:
  //   '"InaiMathi", "Tamil Sangam MN", "Nirmala UI", Latha, Bamini ,Roboto, Noto, "Noto Sans Tamil", sans-serif',
  transformRequest: (url, resourceType) => {
    if (resourceType === "Glyphs") {
        const match = url.match(/(\d+)-(\d+)\.pbf/);
        if (match) {
            const start = parseInt(match[1], 10);
            const end = parseInt(match[2], 10);
            const encodedRangeStarts = [63488, 63232, 62976, 62720, 62464, 62208, 61952, 61696, 61440, 61184, 60928, 60672, 60416, 60160, 59904, 59648, 59392, 59136, 58880, 58624, 58368, 58112, 57856, 57600, 3072, 2816, 2560, 2304, 10240, 10752];
            if (encodedRangeStarts.includes(start)) {
                return { url: `https://wipfli.github.io/pgf-glyph-ranges/font/NotoSansMultiscript-Regular-v1/${start}-${end}.pbf` };
            }
        }
    }
    return undefined;
  }
}));
const mapCanvas = map.getCanvas();

const supportedLanguages = [
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'it',
  'ja',
  'ko',
  'mul',
  'pt',
  'ru',
  'vi',
  'zh-Hans',
  'zh-Hant',
];
function browserLanguage() {
  const language = navigator.languages
    ? navigator.languages[0]
    : navigator.language || navigator.userLanguage;
  const parts = language && language.split('-');
  let languageCode = language;
  if (parts.length > 1) {
    languageCode = parts[0];
  }
  if (supportedLanguages.indexOf(languageCode) > -1) {
    return languageCode;
  }
  const closestLanguageCode = supportedLanguages.find((l) => {
    return l.startsWith(languageCode);
  });
  if (closestLanguageCode) return closestLanguageCode;
  return null;
}

map.addControl(
  new MapboxLanguage({
    defaultLanguage: browserLanguage(),
  }),
);

map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
    },
    trackUserLocation: true,
  }),
  'bottom-right',
);

const mapLoaded = new Promise((res) => {
  map.once('load', () => {
    console.timeStamp('Map load');
    res();
  });
});

const lineColors = {
  orangered: '#d42e12',
  mediumseagreen: '#009645',
  orange: '#fa9e0d',
  saddlebrown: '#9D5B25',
  darkmagenta: '#9900aa',
  darkslateblue: '#005ec4',
  gray: '#748477',
};
const lineColorsExpression = [
  'match',
  ['get', 'line_color'],
  ...Object.keys(lineColors)
    .map((c) => [c, lineColors[c]])
    .flat(),
  '#748477',
];

function formatArriveTime(str) {
  if (/\d/.test(str)) {
    return str + ' min' + (str == '1' ? '' : 's');
  }
  return str;
}

const origTitle = document.title;
let currentStation;
const stationView = {
  mount: (feature) => {
    // set title
    const { properties, geometry } = feature;
    const {
      name,
      'name_zh-Hans': name_zh_Hans,
      name_ta,
      station_codes,
      station_colors,
      wikipedia_slug,
    } = properties;

    document.title = `${name} / ${name_zh_Hans} / ${name_ta} (${station_codes}) – RailRouter SG`;

    $station.classList.remove('min');

    const zoom = map.getZoom();
    const isScreenLarge = window.innerWidth >= 640;
    const padding = isScreenLarge
      ? { left: 320 }
      : { bottom: window.innerHeight / 2 };
    if (zoom <= 13) {
      map.jumpTo({
        center: geometry.coordinates,
        zoom: 16.5,
        pitch: 70,
        padding,
      });
    } else {
      map.easeTo({
        center: geometry.coordinates,
        zoom: 16.5,
        pitch: 70,
        padding,
        duration: 500,
      });
    }

    if (station_codes === currentStation) return;

    currentStation = station_codes;
    $station.innerHTML = `
      <header>
        <span class="pill">
          ${station_codes
            .split('-')
            .map(
              (c, i) =>
                `<span class="${station_colors.split('-')[i]}">${c.replace(
                  /^([a-z]+)/i,
                  '$1 ',
                )}</span>`,
            )
            .join('')}
        </span>
        <h2>
          ${name}<br>
          <span lang="zh" class="ib">${name_zh_Hans}</span>&nbsp;&nbsp;&nbsp;
          <span lang="ta" class="ib">${name_ta}</span>
        </h2>
      </header>
      <div class="scrollable">
        ${
          /* <div class="arrivals"><h3>Arrival times</h3><p>Loading&hellip;</p></div> */ ''
        }
        <div class="exits"></div>
        <div class="wikipedia"></div>
      </div>
      `;
    $station.classList.add('open');
    // arrivalTimes.mount(name);
    stationsExits.mount(exitsData[station_codes], feature);
    wikipedia.mount(wikipedia_slug);
  },
  unmount: () => {
    document.title = origTitle;
    currentStation = null;
    $station.classList.remove('open');
    $station.classList.remove('min');

    const zoom = map.getZoom();
    const isScreenLarge = window.innerWidth >= 800;
    map.easeTo({
      zoom: zoom - 1,
      pitch: 0,
      bearing: 0,
      padding: isScreenLarge ? { left: 0 } : { bottom: 0 },
      duration: 500,
    });
  },
};

let arrivalTimeout;
const arrivalTimes = {
  render: (name) => {
    const $arrivals = $station.querySelector('.arrivals');
    fetch(
      `https://connectv3.smrt.wwprojects.com/smrt/api/train_arrival_time_by_id/?station=${encodeURIComponent(
        name,
      )}`,
    )
      .then((res) => res.json())
      .then(({ results }) => {
        if (!results.length) {
          throw new Error('No results');
        }
        const html = results
          .filter((result, pos, arr) => {
            // Filter weird destination names
            if (/do not board/i.test(result.next_train_destination))
              return false;
            return (
              arr.findIndex(
                (r) =>
                  r.next_train_destination == result.next_train_destination,
              ) == pos
            );
          })
          .map((result) => {
            let arrow = '⇢';
            const isWeirdName = /do not board/i.test(
              result.next_train_destination,
            );
            if (result.next_train_destination == result.mrt) {
              arrow = '⇠';
            }
            let dest = result.next_train_destination;
            if (isWeirdName) {
              if (/do not board/i.test(result.subseq_train_destination)) {
                // Weird name again
                dest = result.mrt;
                arrow = '⇠';
              } else {
                dest = result.subseq_train_destination;
              }
            }
            return `<tr>
              <td>${arrow} ${dest}</td>
              <td>${result.next_train_arr}</td>
              <td>${formatArriveTime(result.subseq_train_arr)}</td>
            </tr>`;
          })
          .join('');

        $arrivals.innerHTML = `<h3>Arrival times</h3>
        <table>
          <tbody>
            ${html}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">
                <small>Arrival times powered by <a href="https://www.smrttrains.com.sg/" target="_blank">SMRT Trains Ltd.</a></small>
              </td>
            </tr>
          </tfoot>
        </table>`;
      })
      .catch((e) => {
        $arrivals.innerHTML = `<h3>Arrival times</h3>
          <p>No arrival times available</p>`;
      });
  },
  mount: (name) => {
    clearTimeout(arrivalTimeout);
    arrivalTimes.render(name);
    arrivalTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        arrivalTimes.render(name);
      });
    }, 30 * 1000); // every 30 seconds
  },
  unmount: () => {
    clearTimeout(arrivalTimeout);
  },
};

const wikipedia = {
  mount: (slug) => {
    const $wikipedia = $station.querySelector('.wikipedia');
    fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        slug,
      )}`,
    )
      .then((res) => res.json())
      .then((res) => {
        const {
          content_urls: {
            desktop: { page },
          },
          extract_html,
          thumbnail: { source, width, height },
        } = res;
        const html = `<div>
          <img src="${source.replace(
            /\d{3,}px/i,
            '640px',
          )}" width="${width}" height="${height}" style="aspect-ratio: ${width} / ${height}" alt="">
          <div class="extract">${extract_html}</div>
          <div class="more"><a href="${page}" target="_blank">Read more on Wikipedia</a></div>
        </div>`;
        $wikipedia.innerHTML = html;
      });
  },
};

const stationsExits = {
  onExitClick: (e) => {
    const $exit = e.target.closest('.exit-btn');
    if (!$exit) return;
    const coords = $exit.dataset.coords.split(',').map(parseFloat);
    const angle = $exit.dataset.angle;
    map.flyTo({
      center: coords,
      zoom: 20,
      bearing: angle,
    });
  },
  mount: (exits, feature) => {
    const $exits = $station.querySelector('.exits');
    const sortedExits = exits.sort((a, b) => {
      if (isNaN(a.properties.name)) {
        if (a.properties.name < b.properties.name) return -1;
        if (a.properties.name > b.properties.name) return 1;
        return 0;
      }
      return a.properties.name - b.properties.name;
    });
    const { coordinates: stationCoords } = feature.geometry;
    const hasDups = sortedExits.some(
      (exit, i) => exit.properties.name == sortedExits[i + 1]?.properties.name,
    );

    // check missing exits by comparing total exits to last exit number, only for numbered exits
    const hasMissingExits =
      !isNaN(sortedExits[0].properties.name) &&
      sortedExits.length < sortedExits[sortedExits.length - 1].properties.name;

    const html = sortedExits
      .map(({ properties: { name }, geometry: { coordinates } }) => {
        // angle between stationCoords and coordinates, relative to north, in degrees
        const angle = Math.atan2(
          stationCoords[0] - coordinates[0],
          stationCoords[1] - coordinates[1],
        );
        const angleDeg = (angle * 180) / Math.PI;
        return `
          <button type="button" data-coords="${coordinates.join(
            ',',
          )}" data-angle="${angleDeg}" class="exit-btn">${name}</button>
        `;
      })
      .join('');
    $exits.innerHTML = `<h3>${exits.length} Exit${
      exits.length === 1 ? '' : 's'
    }</h3>
      <div class="exits-container">
      ${html}
      </div>
      ${
        hasDups
          ? '<p class="note"><small>Note: The data unfortunately contains duplicated exits. Please check your surroundings before proceeding.</small></p>'
          : ''
      }
      ${
        hasMissingExits
          ? '<p class="note"><small>Note: The data unfortunately contains missing exits. They could also be under construction or not opened yet.</small></p>'
          : ''
      }
      `;
    $station.addEventListener('click', stationsExits.onExitClick);
  },
  unmount: () => {
    $station.removeEventListener('click', stationsExits.onExitClick);
  },
};

// format HH:MM for startTime and endTime
const formatTime = (datetime, showAMPM = false) => {
  const date = new Date(datetime);
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? `0${minutes}` : minutes;
  const strTime = `${hours}:${minutes}${showAMPM ? ampm : ''}`;
  return strTime;
};

/**
 * Food Finder Module 
 * Handles restaurant search and display functionality
 */
const foodFinder = {
  activeRestaurantMarkers: [],
  restaurantSource: null,
  selectedLocation: null,
  
  // Initialize food finder functionality
  init: async () => {
    // Toggle visibility of food finder content
    $toggleFoodFinder.addEventListener('click', () => {
      $foodFinder.classList.toggle('collapsed');
    });
    
    // Initially collapsed on mobile
    if (window.innerWidth < 640) {
      $foodFinder.classList.add('collapsed');
    }
    
    // Populate station dropdown
    await foodFinder.populateStationDropdown();
    
    // Add event listeners
    $findRestaurants.addEventListener('click', foodFinder.findRestaurants);
    $useMyLocation.addEventListener('click', foodFinder.useMyLocation);
    
    // Initialize restaurant layer
    await mapLoaded;
    foodFinder.initRestaurantLayer();
    
    // Load restaurant icon
    map.loadImage(require('./restaurant.png'), (err, img) => {
      if (err) throw err;
      map.addImage('restaurant', img);
    });
  },
  
  // Populate station dropdown with station data
  populateStationDropdown: async () => {
    const data = await geojsonFetch.then(res => res.json());
    const stations = data.features.filter(f => f.properties.stop_type === 'station');
    
    // Sort stations alphabetically by name
    stations.sort((a, b) => a.properties.name.localeCompare(b.properties.name));
    
    // Add options to dropdown
    stations.forEach(station => {
      const option = document.createElement('option');
      option.value = JSON.stringify({
        name: station.properties.name,
        coordinates: station.geometry.coordinates
      });
      option.textContent = `${station.properties.name} (${station.properties.station_codes})`;
      $stationSelect.appendChild(option);
    });
  },
  
  // Initialize restaurant layer on the map
  initRestaurantLayer: () => {
    // Add source for restaurants
    map.addSource('restaurants', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    foodFinder.restaurantSource = map.getSource('restaurants');
    
    // Add restaurant marker layer
    map.addLayer({
      id: 'restaurants-markers',
      type: 'symbol',
      source: 'restaurants',
      layout: {
        'icon-image': 'restaurant',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.5, 17, 1],
        'icon-allow-overlap': true
      }
    });
    
    // Add click event for restaurant markers
    map.on('click', 'restaurants-markers', (e) => {
      const { properties, geometry } = e.features[0];
      const coordinates = geometry.coordinates.slice();
      
      // Parse the stringified properties
      const restaurant = JSON.parse(properties.details);
      
      // Create popup content
      const popupContent = `
        <div class="restaurant-popup">
          <div class="restaurant-popup-name">${restaurant.name}</div>
          <div class="restaurant-popup-info">
            <span class="restaurant-popup-rating">${restaurant.rating}</span>
            · ${restaurant.user_ratings_total} reviews
          </div>
          <div class="restaurant-popup-address">${restaurant.vicinity || restaurant.formatted_address || ''}</div>
          ${restaurant.photos ? 
            `<img class="restaurant-popup-photo" src="${restaurant.photos[0].getUrl}" alt="${restaurant.name}">` : ''}
        </div>
      `;
      
      // Ensure that if the map is zoomed out such that multiple
      // copies of the feature are visible, the popup appears
      // over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }
      
      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map);
    });
    
    // Change cursor on hover
    map.on('mouseenter', 'restaurants-markers', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', 'restaurants-markers', () => {
      map.getCanvas().style.cursor = '';
    });
  },
  
  // Find restaurants based on selected station
  findRestaurants: async () => {
    const selectedValue = $stationSelect.value;
    if (!selectedValue) {
      alert('Please select a station first');
      return;
    }
    
    const stationData = JSON.parse(selectedValue);
    foodFinder.selectedLocation = {
      lat: stationData.coordinates[1],
      lng: stationData.coordinates[0],
      name: stationData.name
    };
    
    await foodFinder.searchNearbyRestaurants();
  },
  
  // Use user's current location to find restaurants
  useMyLocation: () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        foodFinder.selectedLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Your Location'
        };
        
        await foodFinder.searchNearbyRestaurants();
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please check your location settings and try again.');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  },
  
  // Search for restaurants near a location using Google Places API
  searchNearbyRestaurants: async () => {
    try {
      $foodFinderResults.innerHTML = '<p>Searching for restaurants...</p>';
      
      // Fetch data from Google Places API through your proxy/backend
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        throw new Error('Google Places API key is not configured');
      }
      
      const location = foodFinder.selectedLocation;
      const response = await fetch(`https://places.googleapis.com/v1/places:searchNearby`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.id,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos'
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: {
                latitude: location.lat,
                longitude: location.lng
              },
              radius: 1000 // 1km radius
            }
          },
          includedTypes: ['restaurant', 'cafe', 'bakery', 'food']
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process the results
      if (!data.places || data.places.length === 0) {
        $foodFinderResults.innerHTML = '<p>No restaurants found nearby.</p>';
        // Clear any existing markers
        foodFinder.updateRestaurantMarkers([]);
        return;
      }
      
      // Transform the results to GeoJSON format
      const restaurantFeatures = data.places.slice(0, 10).map(place => {
        // Prepare photo URLs if available
        let photos = null;
        if (place.photos && place.photos.length > 0) {
          photos = place.photos.map(photo => {
            return {
              getUrl: `https://places.googleapis.com/v1/${photo.name}/media?key=${apiKey}&maxHeightPx=400&maxWidthPx=400`
            };
          });
        }
        
        // Create a restaurant object with necessary details
        const restaurant = {
          id: place.id,
          name: place.displayName?.text || 'Unnamed Restaurant',
          vicinity: place.formattedAddress,
          formatted_address: place.formattedAddress,
          rating: place.rating || 'No rating',
          user_ratings_total: place.userRatingCount || 0,
          photos: photos
        };
        
        // Create a GeoJSON feature
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [place.location.longitude, place.location.latitude]
          },
          properties: {
            id: place.id,
            name: place.displayName?.text || 'Unnamed Restaurant',
            details: JSON.stringify(restaurant)
          }
        };
      });
      
      // Update the map with the new markers
      foodFinder.updateRestaurantMarkers(restaurantFeatures);
      
      // Display results in the panel
      foodFinder.displayRestaurantResults(restaurantFeatures);
      
      // Fit map to include both the selected location and restaurants
      foodFinder.fitMapToRestaurants(restaurantFeatures);
      
    } catch (error) {
      console.error('Error fetching restaurant data:', error);
      $foodFinderResults.innerHTML = `<p>Error finding restaurants: ${error.message}. Please try again later.</p>`;
      
      // If error is related to the API key, provide more guidance
      if (error.message.includes('API key')) {
        $foodFinderResults.innerHTML += `<p>Make sure you have configured your Google Places API key in the .env file.</p>`;
      }
    }
  },
  
  // Update restaurant markers on the map
  updateRestaurantMarkers: (features) => {
    // Update the GeoJSON source with new features
    if (foodFinder.restaurantSource) {
      foodFinder.restaurantSource.setData({
        type: 'FeatureCollection',
        features: features
      });
    }
  },
  
  // Display restaurant results in the food finder panel
  displayRestaurantResults: (features) => {
    if (features.length === 0) {
      $foodFinderResults.innerHTML = '<p>No restaurants found nearby.</p>';
      return;
    }
    
    const locationName = foodFinder.selectedLocation.name;
    
    let html = `<h4>Restaurants near ${locationName}</h4>`;
    html += '<ul class="restaurant-list">';
    
    features.forEach(feature => {
      const restaurant = JSON.parse(feature.properties.details);
      html += `
        <li class="restaurant-item" data-id="${restaurant.id}">
          <div class="restaurant-name">${restaurant.name}</div>
          <div class="restaurant-info">
            <span class="restaurant-rating">${restaurant.rating}</span>
            <span>${restaurant.user_ratings_total} reviews</span>
          </div>
        </li>
      `;
    });
    
    html += '</ul>';
    $foodFinderResults.innerHTML = html;
    
    // Add click event to restaurant items
    const restaurantItems = $foodFinderResults.querySelectorAll('.restaurant-item');
    restaurantItems.forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const feature = features.find(f => JSON.parse(f.properties.details).id === id);
        if (feature) {
          map.flyTo({
            center: feature.geometry.coordinates,
            zoom: 17
          });
          
          // Simulate click on the marker to show the popup
          setTimeout(() => {
            const restaurantFeature = map.queryRenderedFeatures(
              map.project(feature.geometry.coordinates),
              { layers: ['restaurants-markers'] }
            )[0];
            
            if (restaurantFeature) {
              map.fire('click', {
                lngLat: feature.geometry.coordinates,
                point: map.project(feature.geometry.coordinates),
                features: [restaurantFeature]
              });
            }
          }, 500);
        }
      });
    });
  },
  
  // Fit map view to include both selected location and restaurants
  fitMapToRestaurants: (features) => {
    if (features.length === 0) return;
    
    const bounds = new mapboxgl.LngLatBounds();
    
    // Add the selected location to the bounds
    bounds.extend([foodFinder.selectedLocation.lng, foodFinder.selectedLocation.lat]);
    
    // Add all restaurant locations to the bounds
    features.forEach(feature => {
      bounds.extend(feature.geometry.coordinates);
    });
    
    // Fit the map to the bounds with padding
    map.fitBounds(bounds, {
      padding: 100,
      maxZoom: 16
    });
  }
};

(async () => {
  await mapLoaded;
  const layers = map.getStyle().layers;
  // console.log(layers);

  const labelLayerId = layers.find(
    (l) => l.type === 'symbol' && l.layout['text-field'],
  ).id;

  const data = await geojsonFetch.then((res) => res.json());
  const exitsFeatures = data.features.filter((f) => {
    return f.properties.stop_type === 'entrance';
  });
  // Group entrances by station_codes
  exitsFeatures.forEach((f) => {
    const {
      properties: { station_codes },
    } = f;
    if (!exitsData[station_codes]) exitsData[station_codes] = [];
    exitsData[station_codes].push(f);
  });

  map.addSource('rail', {
    type: 'geojson',
    data,
    buffer: 0,
  });

  // LINES
  map.addLayer(
    {
      id: 'lines-case',
      source: 'rail',
      filter: ['==', ['geometry-type'], 'LineString'],
      type: 'line',
      minzoom: 11,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 22, 30],
        'line-color': lineColorsExpression,
        'line-opacity': 0.25,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 10, 0, 22, 14],
      },
    },
    'building-extrusion',
  );
  map.addLayer(
    {
      id: 'lines',
      source: 'rail',
      filter: ['==', ['geometry-type'], 'LineString'],
      type: 'line',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1, 22, 2],
        'line-color': lineColorsExpression,
      },
    },
    labelLayerId,
  );
  map.addLayer({
    id: 'lines-label',
    source: 'rail',
    filter: ['==', ['geometry-type'], 'LineString'],
    type: 'symbol',
    minzoom: 13,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-letter-spacing': 0.1,
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 22, 16],
      'text-pitch-alignment': 'viewport',
      'text-rotation-alignment': 'map',
      'text-max-angle': 30,
      'text-padding': 1,
    },
    paint: {
      'text-color': lineColorsExpression,
      'text-halo-blur': 1,
      'text-halo-color': '#fff',
      'text-halo-width': 2,
    },
  });

  // EXITS
  map.addLayer({
    id: 'exits',
    source: 'rail',
    filter: ['==', ['get', 'stop_type'], 'entrance'],
    type: 'symbol',
    minzoom: 14,
    layout: {
      'icon-image': 'exit',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.25, 17, 0.6],
      'icon-allow-overlap': true,
    },
  });
  map.addLayer({
    id: 'exits-label',
    source: 'rail',
    filter: ['==', ['get', 'stop_type'], 'entrance'],
    type: 'symbol',
    minzoom: 14,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 14, 5, 17, 13],
      'text-ignore-placement': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#000',
      'text-translate-anchor': 'viewport',
      'text-translate': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14,
        ['literal', [0, 1]],
        16,
        ['literal', [0, 2]],
      ],
    },
  });

  // STATIONS
  map.addLayer({
    id: 'stations-point',
    source: 'rail',
    filter: ['==', ['get', 'stop_type'], 'station'],
    type: 'symbol',
    minzoom: 10,
    maxzoom: 14,
    layout: {
      'icon-image': ['get', 'station_colors'],
      'icon-size': [
        'interpolate',
        ['exponential', 2],
        ['zoom'],
        10,
        0.2,
        14,
        1,
      ],
      'icon-allow-overlap': true,
    },
  });
  map.addLayer({
    id: 'stations-point-label',
    source: 'rail',
    filter: [
      'all',
      ['==', ['get', 'stop_type'], 'station'],
      ['in', '-', ['get', 'station_codes']],
    ],
    type: 'symbol',
    minzoom: 10,
    maxzoom: 13,
    layout: {
      'symbol-avoid-edges': true,
      'text-field': ['get', 'name'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 13, 12],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-variable-anchor': ['left', 'right'],
      'text-radial-offset': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        ['*', 0.25, ['get', 'network_count']],
        13,
        ['*', 0.5, ['get', 'network_count']],
      ],
      'text-max-width': 20,
      'text-optional': true,
    },
    paint: {
      'text-color': 'rgba(0,0,0,.5)',
      'text-halo-color': 'rgba(255,255,255,.5)',
      'text-halo-width': 1,
      'text-halo-blur': 1,
    },
  });
  map.addLayer({
    id: 'stations-label-non-en',
    source: 'rail',
    filter: ['==', ['get', 'stop_type'], 'station'],
    type: 'symbol',
    minzoom: 13,
    layout: {
      'text-field': [
        'format',
        ['get', 'name_zh-Hans'],
        {},
        '\n',
        {},
        ['get', 'name_ta'],
        {
          // 'text-font': ['literal', ['Noto Sans Tamil Medium']],
          // 'font-scale': 1.1, // Slightly larger text size for Tamil
        },
      ],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 16, 16],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'text-max-width': 20,
      'text-optional': true,
    },
    paint: {
      'text-halo-color': '#fff',
      'text-halo-width': 2,
      'text-halo-blur': 1,
    },
  });
  map.addLayer({
    id: 'stations-label',
    source: 'rail',
    filter: ['==', ['get', 'stop_type'], 'station'],
    type: 'symbol',
    minzoom: 13,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 16, 16],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-anchor': 'bottom',
      'text-offset': [0, -0.8],
      'text-max-width': 20,
      // 'text-allow-overlap': true,
      'icon-image': ['get', 'station_codes'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 15, 0.5],
      'icon-ignore-placement': true,
      'icon-allow-overlap': true,
    },
    paint: {
      'text-halo-color': '#fff',
      'text-halo-width': 2,
      'text-halo-blur': 1,
    },
  });

  // STATION BUILDINGS
  map.addLayer(
    {
      id: 'buildings-underground',
      source: 'rail',
      filter: [
        'all',
        ['==', ['get', 'type'], 'subway'],
        ['==', ['get', 'underground'], true],
      ],
      type: 'fill',
      minzoom: 14,
      paint: {
        'fill-antialias': false,
        'fill-color': 'hsla(6, 63%, 60%, 0.3)',
        'fill-outline-color': '#d96659',
      },
    },
    'building-extrusion',
  );
  map.addLayer(
    {
      id: 'buildings-aboveground',
      source: 'rail',
      filter: [
        'all',
        ['==', ['get', 'type'], 'subway'],
        ['==', ['get', 'underground'], false],
      ],
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#d96659',
        'fill-extrusion-height': 20,
        'fill-extrusion-opacity': 0.3,
      },
    },
    'building-extrusion',
  );

  // const handleSource = (e) => {
  //   if (e.sourceId !== 'rail' || e.sourceDataType === 'metadata') return;
  //   map.off('sourcedata', handleSource);

  //   const lineFeatures = map.querySourceFeatures('rail', {
  //     filter: ['==', ['geometry-type'], 'LineString'],
  //   });

  //   const linesBounds = {};
  //   lineFeatures.forEach((l) => {
  //     const {
  //       properties: { name },
  //       geometry: { type, coordinates },
  //     } = l;
  //     if (!linesBounds[name]) linesBounds[name] = new mapboxgl.LngLatBounds();
  //     coordinates.flat(type === 'LineString' ? 0 : 1).forEach((c) => {
  //       linesBounds[name].extend(c);
  //     });
  //   });
  //   console.log(lineFeatures, linesBounds);
  // };
  // map.on('sourcedata', handleSource);

  map.on('click', 'stations-label', (e) => {
    location.hash = `stations/${e.features[0].properties.name}`;
    // stationView.mount(e.features[0]);
  });

  // Handle onhashchange
  const onHashChange = () => {
    // hash looks like this "stations/[NAME]", get the NAME, find it in the geojson and show it
    const name = decodeURIComponent(location.hash.split('/')[1] || '');
    const stationData =
      name &&
      data.features.find((f) => {
        const { name: fName, station_codes } = f.properties;
        const hasName = (fName || '').toLowerCase() === name.toLowerCase();
        if (hasName) return true;
        // Also works if "stations/[CODE]" e.g. "stations/NS1"
        const codes = station_codes.split('-');
        // Array.includes but case-insensitive
        return codes.some((c) => c.toLowerCase() === name.toLowerCase());
      });
    if (stationData) {
      stationView.mount(stationData);
    } else {
      stationView.unmount();
    }
  };
  window.addEventListener('hashchange', onHashChange);
  requestAnimationFrame(onHashChange);

  document.querySelector('.sheet-close').onclick = (e) => {
    e.preventDefault();
    location.hash = '';
    // stationView.unmount();
  };

  map.on('movestart', (e) => {
    if (!e.originalEvent) return; // Not initiated by humans
    if (!currentStation) return;
    $station.classList.add('min');
  });

  $station.onclick = (e) => {
    if ($station.classList.contains('min')) {
      e.preventDefault();
      e.stopPropagation();
      $station.classList.remove('min');
    }
  };

  map.on('mouseenter', 'stations-label', () => {
    mapCanvas.style.cursor = 'pointer';
  });
  map.on('mouseleave', 'stations-label', () => {
    mapCanvas.style.cursor = '';
  });

  setTimeout(() => {
    map.loadImage(require('./exit.png'), (e, img) => {
      map.addImage('exit', img);
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    });
    map.loadImage(require('./stations.png'), (e, img) => {
      if (!img) return;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      stationsSprite.forEach((s) => {
        const [code, ...args] = s;
        const imageData = ctx.getImageData(...args);
        map.addImage(code, imageData);
      });
    });

    stationsData = data.features.filter((f) => {
      return f.properties.stop_type === 'station';
    });
    fuse = new Fuse(stationsData, {
      distance: 5,
      includeMatches: true,
      keys: [
        'properties.name',
        'properties.name_zh-Hans',
        'properties.name_ta',
        {
          name: 'station_codes',
          getFn: (obj) => {
            return obj.properties.station_codes.split('-');
          },
          weight: 0.5,
        },
      ],
    });

    map.addSource('walks', {
      type: 'geojson',
      data: require('./sg-rail-walks.geo.json'),
      buffer: 0,
    });
    map.addLayer(
      {
        id: 'walks-case',
        source: 'walks',
        filter: ['==', ['geometry-type'], 'LineString'],
        type: 'line',
        minzoom: 14,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 15, 3, 22, 15],
          'line-color': 'rgba(255, 255, 255, .75)',
        },
      },
      'building-extrusion',
    );
    map.addLayer(
      {
        id: 'walks',
        source: 'walks',
        filter: ['==', ['geometry-type'], 'LineString'],
        type: 'line',
        minzoom: 14,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1, 22, 5],
          'line-color': 'skyblue',
          'line-dasharray': [0.5, 2],
        },
      },
      'building-extrusion',
    );
    map.addLayer(
      {
        id: 'walks-label',
        source: 'walks',
        filter: ['==', ['geometry-type'], 'Point'],
        type: 'symbol',
        minzoom: 15.5,
        layout: {
          'text-field': ['concat', ['get', 'duration_min'], ' mins'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 15, 12, 22, 16],
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'icon-image': 'walk',
          'icon-size': 0.5,
        },
        paint: {
          'text-color': 'dodgerblue',
          'text-halo-color': 'rgba(255,255,255,.75)',
          'text-halo-width': 2,
          'icon-halo-color': 'rgba(255,255,255,.75)',
          'icon-halo-width': 2,
        },
      },
      'exits-label',
    );
    map.on('mouseenter', 'walks-label', () => {
      mapCanvas.style.cursor = 'pointer';
    });
    map.on('mouseleave', 'walks-label', () => {
      mapCanvas.style.cursor = '';
    });
    map.on('click', 'walks-label', (e) => {
      const f = e.features[0];
      const {
        duration_min,
        station_codes_1,
        station_codes_2,
        exit_name_1,
        exit_name_2,
      } = f.properties;
      const station1 = stationsData.find(
        (d) => d.properties.station_codes === station_codes_1,
      );
      const station2 = stationsData.find(
        (d) => d.properties.station_codes === station_codes_2,
      );
      alert(
        `${duration_min}-min walk between ${station1.properties.name} (Exit ${exit_name_1}) and ${station2.properties.name} (Exit ${exit_name_2})`,
      );
    });
    map.loadImage(require('./walk.png'), (e, img) => {
      map.addImage('walk', img);
    });
    
    // Initialize food finder
    foodFinder.init();
  }, 300);

  let markers = [];
  map.on('zoomend', () => {
    const zoom = map.getZoom();
    const large = zoom >= 12;
    const larger = zoom >= 15;
    markers.forEach((m) => {
      m.getElement().classList.toggle('large', large);
      m.getElement().classList.toggle('larger', larger);
      m.getElement().style.cursor = zoom >= 13 ? 'pointer' : '';
    });
  });
  const renderCrowd = () => {
    markers.forEach((m) => {
      m.remove();
    });

    fetch('https://sg-rail-crowd.cheeaun.workers.dev/')
      .then((res) => res.json())
      .then((results) => {
        const zoom = map.getZoom();
        const large = zoom >= 12;
        const larger = zoom >= 15;
        const crowdedData = [];
        results.data.forEach((r) => {
          const { station, crowdLevel } = r;
          if (!crowdLevel || (crowdLevel !== 'h' && crowdLevel !== 'm')) return;
          const f = data.features.find((f) =>
            f.properties.station_codes.split('-').includes(station),
          );

          if (!f) return;

          crowdedData.push(r);

          // const markerCrowdLabel = Math.random() < 0.5 ? 'h' : 'm';
          const markerCrowdLabel = crowdLevel;

          const el = document.createElement('div');
          const width = 50;
          const height = 50;
          el.className = `crowd-marker crowd-marker-${markerCrowdLabel} ${
            large ? 'large' : ''
          } ${larger ? 'larger' : ''}`;
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;

          // Add markers to the map.
          const marker = new mapboxgl.Marker(el)
            .setLngLat(f.geometry.coordinates)
            .addTo(map);
          markers.push(marker);
        });

        if (crowdedData.length) {
          const startTime = formatTime(crowdedData[0].startTime);
          const endTime = formatTime(crowdedData[0].endTime);

          console.log({
            startTime,
            endTime,
          });
          console.table(
            crowdedData.map((d) => ({
              station: d.station,
              crowdLevel: d.crowdLevel,
            })),
          );
        }

        if (results.data.length) {
          $crowdedTiming.innerHTML = `Crowded time interval: <b>${formatTime(
            results.data[0].startTime,
          )} - ${formatTime(results.data[0].endTime, true)}</b>`;
        } else {
          $crowdedTiming.innerHTML = 'Crowded time interval: N/A';
        }
      })
      .catch((e) => {
        $crowdedTiming.innerHTML = 'Crowded time interval: N/A';
      })
      .finally(() => {
        setTimeout(() => {
          requestAnimationFrame(renderCrowd);
        }, 1000 * 60); // 1 minute
      });
  };
  renderCrowd();
})();

class SearchControl {
  options = {
    onClick: () => {},
  };

  constructor(options) {
    Object.assign(this.options, options);
  }

  onAdd(map) {
    this._map = map;
    const container = document.createElement('div');
    container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    container.innerHTML = `
      <button class="mapboxgl-ctrl-emoji" type="button">
        <span>🔍</span>
      </button>
    `;
    container.querySelector('button').onclick = this.options.onClick;
    this._container = container;
    return this._container;
  }
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}
function focusSearchField() {
  $search.hidden = false;
  $searchField.focus();
  setTimeout(() => {
    $searchField.focus();
  }, 1500);
}
map.addControl(
  new SearchControl({
    onClick: focusSearchField,
  }),
  'bottom-right',
);
document.onkeydown = (e) => {
  if (/(input|textarea|select)/i.test(e.target.tagName)) return;
  if (
    e.code.toLowerCase() === 'slash' ||
    e.key === '/' ||
    e.keyCode === 191 ||
    e.which === 191
  ) {
    e.preventDefault();
    focusSearchField();
  }
};

$searchField.oninput = () => {
  if (!fuse) return;
  const value = $searchField.value.trim();
  const results = fuse.search(value);
  $searchResults.innerHTML = results
    .slice(0, 10)
    .map((r) => {
      const {
        item: { properties },
        matches,
      } = r;
      const firstNameMatch = matches.find((m) => /name/i.test(m.key));
      const { name: stationName, station_codes, station_colors } = properties;
      const name =
        properties[
          firstNameMatch ? firstNameMatch.key.replace(/.+\./, '') : 'name'
        ];
      const html = `<li data-codes="${station_codes}" tabindex="-1">
      <a href="#stations/${stationName}">
        <span class="pill mini">
          ${station_codes
            .split('-')
            .map(
              (c, i) =>
                `<span class="${station_colors.split('-')[i]}">${c.replace(
                  /^([a-z]+)/i,
                  '$1 ',
                )}</span>`,
            )
            .join('')}
        </span>
        ${name}
      </a>
    </li>`;
      return html;
    })
    .join('');
};

$searchField.onkeydown = (e) => {
  // Enter
  if (e.code.toLowerCase() === 'enter' || e.keyCode === 13 || e.which === 13) {
    $searchField.blur();
    $searchResults.querySelector('a')?.click();
  }
};

$searchCancel.onclick = () => {
  $search.hidden = true;
  $searchField.value = '';
};

$searchResults.onclick = (e) => {
  // const { target } = e;
  // if (target.tagName.toLowerCase() !== 'li') return;
  // const { codes } = target.dataset;
  // const feature = stationsData.find(
  //   (d) => d.properties.station_codes === codes,
  // );
  // stationView.mount(feature);
  $search.hidden = true;
  $searchField.value = '';
  document.body.scrollTo(0, 0);
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {
      type: 'module',
    });
  });
}

map.addControl(
  new mapboxgl.NavigationControl({
    showZoom: false,
    visualizePitch: true,
  }),
  'bottom-right',
);
