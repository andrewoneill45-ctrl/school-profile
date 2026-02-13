# England Schools Explorer v2.0

An interactive map application displaying every school in England with search, filtering, contextualised performance data, and school comparison.

## What's New in v2.0

### 1. Landing Screen
Full-screen immersive landing page with search bar, quick filters, and suggestion chips. Users are prompted to search before seeing the map.

### 2. Natural Language Search
Type queries like:
- "Outstanding secondary schools in Darlington"
- "Primary schools in W10"
- "Schools with Attainment 8 above 60"
- "Good schools with more than 1000 pupils"

### 3. Autocomplete Search Bar
Persistent search bar on the map with autocomplete for school names, local authorities, towns, and trusts.

### 4. Contextualised School Profiles
Click any school to see a full modal with:
- Performance metrics with national percentile context ("Top 10%", "Above average")
- Progress bars showing where the school sits on each metric
- LA average comparison markers
- KS2 data for primaries, KS4 data for secondaries

### 5. School Comparison
Pin up to 3 schools, then compare them side-by-side with the best values highlighted.

### 6. Map Clustering
Schools are clustered at low zoom levels for performance. Click clusters to expand.

### 7. Map Style Toggle
Switch between Light, Dark, and Satellite map views.

---

## Setup

### Step 1: Install Node.js (if not already installed)
```bash
brew install node
```

### Step 2: Navigate to the folder
```bash
cd ~/Desktop/school-map-app
```

### Step 3: Install dependencies
```bash
npm install
```

### Step 4: Add your Mapbox token
Open `src/App.jsx` and replace the placeholder token:
```javascript
const MAPBOX_TOKEN = 'pk.your_real_token_here';
```

### Step 5: Add your school data
Replace `src/schools.json` with your full dataset (the one from your previous app).

Your existing `schools.json` should work directly. If you need to re-run the merge scripts for performance data, the expected fields are:

```json
{
  "urn": "123456",
  "name": "School Name",
  "type": "Academy converter",
  "phase": "Secondary",
  "latitude": 51.5074,
  "longitude": -0.1278,
  "postcode": "W10 6AL",
  "pupils": 1200,
  "capacity": 1400,
  "ofsted": "Good",
  "la": "Kensington and Chelsea",
  "town": "London",
  "region": "London",
  "religiousCharacter": "None",
  "gender": "Mixed",
  "trust": "Trust Name or null",
  "fsm_pct": 23.4,
  "attainment8": 52.3,
  "progress8": 0.45,
  "basics_94": 72,
  "basics_95": 55,
  "ks2_rwm_exp": 68,
  "ks2_rwm_high": 15,
  "ks2_read_avg": 105,
  "ks2_math_avg": 104
}
```

### Step 6: Run the app
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Deploy to Netlify

### Option 1: Manual (drag and drop)
```bash
npm run build
```
Then drag the `dist` folder to https://app.netlify.com/drop

### Option 2: GitHub + Netlify (recommended)
1. Push your code to a GitHub repo
2. Go to https://app.netlify.com
3. Click "Add new site" > "Import an existing project"
4. Connect your GitHub repo
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Add your Mapbox token as an environment variable:
   - Key: `VITE_MAPBOX_TOKEN`
   - Value: your token
7. Update `src/App.jsx` to use: `const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;`

Every `git push` will automatically rebuild and deploy.

---

## Tech Stack
- React 18
- Mapbox GL JS via react-map-gl
- Vite (build tool)
- Custom CSS design system (no framework dependencies)

## File Structure
```
src/
  App.jsx                    # Main orchestrator
  main.jsx                   # React entry point
  schools.json               # School data (replace with your full dataset)
  components/
    LandingScreen.jsx/.css   # Landing page with search
    SearchBar.jsx/.css       # Persistent search with autocomplete
    SchoolCard.jsx/.css      # Hover tooltip on map
    SchoolProfile.jsx/.css   # Full modal with contextualised metrics
    ComparePanel.jsx/.css    # Side-by-side comparison
    ComparisonTray.jsx/.css  # Bottom bar for pinned schools
  styles/
    global.css               # Design system, variables, animations
  utils/
    searchParser.js          # Natural language query parser
    dataHelpers.js           # Metrics, formatting, contextualisation
```
