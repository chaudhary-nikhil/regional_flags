# World Flags Explorer

An interactive map application that displays flags of countries and their subregions (states, provinces, territories, etc.).

## Features

- **Interactive World Map**: Click on any country to view its flag and details
- **Country Search**: Search for countries by name
- **Subregion Flags**: View flags of states, provinces, and territories for supported countries
- **Responsive Design**: Works on desktop and mobile devices
- **Color-coded Continents**: Countries are colored by continent for easy identification

## How to Run

### Option 1: Using a Local Server (Recommended)

```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (with http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

### Option 2: Using VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"

### Option 3: Direct File Opening (Limited)

Note: Some browsers may block loading external resources when opening directly. Using a local server is recommended.

## Technologies Used

- **Leaflet.js** - Interactive map library
- **GeoJSON** - Country boundaries data
- **FlagCDN** - Country flag images
- **Wikimedia Commons** - Subregion flag images

## Project Structure

```
regional_flags/
├── index.html    # Main HTML file
├── styles.css    # Stylesheet
├── app.js        # Main application logic
├── data.js       # Country and subregion data
└── README.md     # This file
```

## Usage

1. **View Country Flags**: Click on any country on the map to open the sidebar with the flag and country information
2. **Search**: Use the search box in the top-left corner to find countries by name
3. **View Subregions**: For supported countries, scroll down in the sidebar to see subregion flags
4. **Click Subregions**: Click on any subregion card to see an enlarged view of that flag

## Data Sources

- Country flags: [FlagCDN](https://flagcdn.com/)
- Subregion flags: [Wikimedia Commons](https://commons.wikimedia.org/)
- Map boundaries: [geo-countries](https://github.com/datasets/geo-countries)

## License

This project is for educational purposes. Flag images are from public domain sources.
