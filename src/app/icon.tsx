import { ImageResponse } from 'next/og'

// Image metadata
export const size = {
  width: 192,
  height: 192,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
          borderRadius: '48px',
        }}
      >
        <div
          style={{
            fontSize: 130,
            fontWeight: 700,
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-0.05em',
          }}
        >
          C
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
