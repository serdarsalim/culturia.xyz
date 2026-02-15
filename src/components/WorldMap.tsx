'use client';

import { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import countries from '@/lib/countries';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Professional, high-contrast map palette for country fills
const COUNTRY_COLORS = [
  '#ef4444', // red-500
  '#f59e0b', // amber-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#0ea5e9', // sky-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#e11d48', // rose-600
  '#10b981', // emerald-500
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
  'Dem. Rep. Congo': 'COD',
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

const SPECIAL_MARKERS = [
  {
    code: 'SGP',
    name: 'Singapore',
    coordinates: [103.8198, 1.3521],
  },
  {
    code: 'HKG',
    name: 'Hong Kong',
    coordinates: [114.1694, 22.3193],
  },
];

interface WorldMapProps {
  onCountryClick: (countryCode: string) => void;
  selectedCountry?: string | null;
  onBackgroundClick?: () => void;
  countriesWithVideos?: Set<string>;
}

export default function WorldMap({ onCountryClick, selectedCountry, onBackgroundClick, countriesWithVideos }: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([25, 10]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Update center based on screen size
      setCenter(mobile ? [25, 10] : [20, 10]);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxZoom = isMobile ? 20 : 10;

  return (
    <div
      className="relative w-full h-full"
      style={{ backgroundColor: '#cbd5e1' }} // Professional neutral sea
      onClick={onBackgroundClick}
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
        projection="geoNaturalEarth1"
        projectionConfig={{
          scale: 200,
          center: isMobile ? [25, 10] : [20, 10],
        }}
        className="w-full h-full"
      >
        <ZoomableGroup
          center={center}
          zoom={zoom}
          minZoom={1}
          maxZoom={maxZoom}
          onMoveEnd={(position) => {
            if (position?.coordinates) {
              setCenter(position.coordinates as [number, number]);
            }
            if (typeof (position as any)?.zoom === 'number') {
              setZoom((position as any).zoom);
            } else if (typeof (position as any)?.k === 'number') {
              setZoom((position as any).k);
            }
          }}
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
                const hasVideos = country ? countriesWithVideos?.has(country.code) === true : false;
                const countryColor = hasVideos ? getCountryColor(geoName) : '#94a3b8'; // slate-400 for no posts

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Clicked on:', geoName, 'Country found:', country);
                      setTooltip(null); // Clear tooltip on mobile when clicking
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
                        fill: isSelected ? '#f59e0b' : countryColor,
                        stroke: isSelected ? '#92400e' : '#e2e8f0',
                        strokeWidth: isSelected ? 2 : 0.9,
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        opacity: hasVideos ? 1 : 0.72,
                        filter: 'none',
                      },
                      hover: {
                        fill: isSelected ? '#f59e0b' : countryColor,
                        stroke: isSelected ? '#78350f' : '#cbd5e1',
                        strokeWidth: isSelected ? 2.1 : 1.15,
                        outline: 'none',
                        cursor: 'pointer',
                        filter: isSelected
                          ? 'brightness(0.96)'
                          : hasVideos ? 'brightness(0.96)' : 'brightness(0.985)',
                      },
                      pressed: {
                        fill: isSelected ? '#d97706' : countryColor,
                        stroke: isSelected ? '#78350f' : '#94a3b8',
                        strokeWidth: isSelected ? 2.2 : 1.2,
                        outline: 'none',
                        filter: isSelected
                          ? 'brightness(0.92)'
                          : hasVideos ? 'brightness(0.93)' : 'brightness(0.97)',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>

          {SPECIAL_MARKERS.map((marker) => {
            const country = countries.find((c) => c.code === marker.code);
            if (!country) return null;
            const hasVideos = countriesWithVideos?.has(marker.code) === true;
            const isSelected = selectedCountry === marker.code;
            const fillColor = isSelected ? '#f59e0b' : hasVideos ? '#f97316' : '#94a3b8';

            return (
              <Marker
                key={marker.code}
                coordinates={[marker.coordinates[0], marker.coordinates[1]] as [number, number]}
              >
                <circle
                  r={isSelected ? 4 : 3}
                  fill={fillColor}
                  stroke={isSelected ? '#d97706' : '#fff'}
                  strokeWidth={isSelected ? 1.5 : 1}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(evt) => {
                    const { clientX, clientY } = evt;
                    setTooltip({ name: marker.name, x: clientX, y: clientY });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(evt) => {
                    if (tooltip) {
                      const { clientX, clientY } = evt;
                      setTooltip({ name: marker.name, x: clientX, y: clientY });
                    }
                  }}
                  onClick={(evt) => {
                    evt.stopPropagation();
                    setTooltip(null); // Clear tooltip on mobile when clicking
                    onCountryClick(marker.code);
                  }}
                />
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
