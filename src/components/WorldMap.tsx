'use client';

import { useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import countries from '@/lib/countries';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Color palette for countries (no blue colors to avoid blending with ocean)
const COUNTRY_COLORS = [
  '#FCA5A5', // red-300
  '#FCD34D', // yellow-300
  '#86EFAC', // green-300
  '#C4B5FD', // violet-300
  '#F9A8D4', // pink-300
  '#FDBA74', // orange-300
  '#6EE7B7', // emerald-300
  '#D8B4FE', // purple-300
  '#FDE047', // yellow-400
  '#FB923C', // orange-400
];

// Generate consistent color for a country based on its name
function getCountryColor(geoName: string): string {
  const hash = geoName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COUNTRY_COLORS[hash % COUNTRY_COLORS.length];
}

// Map GeoJSON country names to our country codes
const GEO_NAME_TO_CODE: Record<string, string> = {
  'United States of America': 'USA',
  'Czechia': 'CZE',
  'Palestine': 'PSE',
  'Turkey': 'TUR',
  'Türkiye': 'TUR',
  'Republic of the Congo': 'COG',
  'Democratic Republic of the Congo': 'COD',
  'Congo': 'COG',
  'North Korea': 'PRK',
  'South Korea': 'KOR',
  'Ivory Coast': 'CIV',
  'Côte d\'Ivoire': 'CIV',
  'East Timor': 'TLS',
  'Timor-Leste': 'TLS',
  'Swaziland': 'SWZ',
  'Eswatini': 'SWZ',
};

interface WorldMapProps {
  onCountryClick: (countryCode: string) => void;
  selectedCountry?: string | null;
  onBackgroundClick?: () => void;
}

export default function WorldMap({ onCountryClick, selectedCountry, onBackgroundClick }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 20]);

  return (
    <div
      className="relative w-full h-full"
      style={{ backgroundColor: '#475569' }} // Darker greyish-blue ocean (slate-600)
    >
      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            zIndex: 1000,
            left: tooltip.x + 'px',
            top: tooltip.y + 'px',
            transform: 'translate(-50%, calc(-100% - 12px))',
            padding: '10px 16px',
            backgroundColor: '#000000',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: '600',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em'
          }}
        >
          {tooltip.name}
          {/* Arrow pointing down */}
          <div style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #000000'
          }} />
        </div>
      )}

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 147,
          center: [0, 20],
        }}
        className="w-full h-full"
      >
        <ZoomableGroup
          center={[0, 20]}
          zoom={1}
          minZoom={1}
          maxZoom={8}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                // Match country by name from GeoJSON properties
                const geoName = geo.properties?.name || '';

                // Completely hide Antarctica (no permanent residents)
                if (geoName === 'Antarctica') {
                  return null;
                }

                // First try direct name match, then use mapping
                let country = countries.find(c => c.name.toLowerCase() === geoName.toLowerCase());

                if (!country && GEO_NAME_TO_CODE[geoName]) {
                  country = countries.find(c => c.code === GEO_NAME_TO_CODE[geoName]);
                }

                // If still no match, try to find by partial name match
                if (!country) {
                  country = countries.find(c =>
                    c.name.toLowerCase().includes(geoName.toLowerCase()) ||
                    geoName.toLowerCase().includes(c.name.toLowerCase())
                  );
                }

                const isSelected = selectedCountry === country?.code;
                const countryColor = getCountryColor(geoName);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Clicked on:', geoName, 'Country found:', country);
                      if (country) {
                        console.log('Calling onCountryClick with code:', country.code);
                        onCountryClick(country.code);
                      } else {
                        console.log('No match found for:', geoName);
                      }
                    }}
                    onMouseEnter={(evt) => {
                      if (country) {
                        const { clientX, clientY } = evt;
                        setTooltip({
                          name: country.name,
                          x: clientX,
                          y: clientY,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setTooltip(null);
                    }}
                    onMouseMove={(evt) => {
                      if (tooltip && country) {
                        const { clientX, clientY } = evt;
                        setTooltip({
                          name: country.name,
                          x: clientX,
                          y: clientY,
                        });
                      }
                    }}
                    style={{
                      default: {
                        fill: countryColor,
                        stroke: isSelected ? '#1e40af' : '#fff', // Dark blue border for selected
                        strokeWidth: isSelected ? 2 : 0.75,
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      },
                      hover: {
                        fill: countryColor,
                        stroke: '#1e40af', // Dark blue border on hover
                        strokeWidth: 2,
                        outline: 'none',
                        cursor: 'pointer',
                        filter: 'brightness(0.9)',
                      },
                      pressed: {
                        fill: countryColor,
                        stroke: '#1e40af',
                        strokeWidth: 2,
                        outline: 'none',
                        filter: 'brightness(0.8)',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
