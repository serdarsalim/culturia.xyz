'use client';

import { useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import countries from '@/lib/countries';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Color palette for countries
const COUNTRY_COLORS = [
  '#FCA5A5', // red-300
  '#FCD34D', // yellow-300
  '#86EFAC', // green-300
  '#7DD3FC', // sky-300
  '#C4B5FD', // violet-300
  '#F9A8D4', // pink-300
  '#FDBA74', // orange-300
  '#6EE7B7', // emerald-300
  '#93C5FD', // blue-300
  '#D8B4FE', // purple-300
];

// Generate consistent color for a country based on its name
function getCountryColor(geoName: string): string {
  const hash = geoName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COUNTRY_COLORS[hash % COUNTRY_COLORS.length];
}

interface WorldMapProps {
  onCountryClick: (countryCode: string) => void;
  selectedCountry?: string | null;
  onBackgroundClick?: () => void;
}

export default function WorldMap({ onCountryClick, selectedCountry, onBackgroundClick }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  return (
    <div
      className="relative w-full h-full bg-gradient-to-br from-blue-300 via-blue-400 to-blue-500"
      onClick={(e) => {
        // Close sidebar when clicking on background (not on a country)
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
          onBackgroundClick?.();
        }
      }}
    >
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm rounded-lg shadow-xl pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            marginTop: '-8px',
          }}
        >
          {tooltip.name}
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

                // Exclude Antarctica (no permanent residents)
                if (geoName === 'Antarctica') {
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: '#f3f4f6',
                          stroke: '#d1d5db',
                          strokeWidth: 0.75,
                          outline: 'none',
                        },
                        hover: {
                          fill: '#f3f4f6',
                          stroke: '#d1d5db',
                          strokeWidth: 0.75,
                          outline: 'none',
                          cursor: 'default',
                        },
                        pressed: {
                          fill: '#f3f4f6',
                          stroke: '#d1d5db',
                          strokeWidth: 0.75,
                          outline: 'none',
                        },
                      }}
                    />
                  );
                }

                const country = countries.find(c =>
                  c.name.toLowerCase() === geoName.toLowerCase() ||
                  // Handle some common naming differences
                  (geoName === 'United States of America' && c.name === 'United States') ||
                  (geoName === 'Czechia' && c.name === 'Czech Republic') ||
                  (geoName === 'Palestine' && c.code === 'PSE')
                );
                const isSelected = selectedCountry === country?.code;
                const countryColor = getCountryColor(geoName);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (country) {
                        onCountryClick(country.code);
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
