'use client'

import { useEffect, useRef, useState } from 'react'

const ShapeEditor = ({
  imageUrl = 'https://escalioncloud.ru/uploads/polovinka_uspeha/events/a3bd5d24-d5c6-45ce-b4c0-398dc324a434.jpeg',
  onSave = (value) => console.log(value),
}) => {
  const [points, setPoints] = useState([])
  const [lines, setLines] = useState([])
  const [shapes, setShapes] = useState([])
  const [history, setHistory] = useState([])
  const [selectedPoints, setSelectedPoints] = useState([])
  const [draggingPoint, setDraggingPoint] = useState(null)
  const containerRef = useRef(null)
  const aspectRatio = 3 / 4

  const containerStyle = {
    position: 'relative',
    width: '100%',
    paddingTop: `${aspectRatio * 100}%`,
    backgroundColor: '#f0f0f0',
    cursor: 'crosshair',
  }

  const imageStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
  }

  const pushToHistory = () => {
    setHistory((prev) => [
      ...prev,
      {
        points: [...points],
        lines: [...lines],
      },
    ])
  }

  const undo = () => {
    if (history.length === 0) return

    const newHistory = [...history]
    const lastState = newHistory.pop()
    setPoints(lastState.points || [])
    setLines(lastState.lines || [])
    setShapes([])
    setHistory(newHistory)
  }

  const getRelativePosition = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width
    const height = width * aspectRatio

    const x = ((clientX - rect.left) / width) * 100
    const y = ((clientY - rect.top) / height) * 100

    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    }
  }

  const handleAddPoint = (event) => {
    pushToHistory()
    const pos = getRelativePosition(event.clientX, event.clientY)
    setPoints((prev) => [...prev, pos])
  }

  const handleConnectPoints = (index) => {
    setSelectedPoints((prev) => {
      const newSelection = [...prev, index]
      if (newSelection.length === 2) {
        const [first, second] = newSelection
        pushToHistory()
        setLines((prevLines) => [...prevLines, [first, second]])
        return []
      }
      return newSelection
    })
  }

  const handleDragStart = (index, event) => {
    event.stopPropagation()
    setDraggingPoint(index)
  }

  const handleDrag = (event) => {
    if (draggingPoint === null) return
    const pos = getRelativePosition(event.clientX, event.clientY)
    setPoints((prev) => prev.map((point, i) => (i === draggingPoint ? pos : point)))
  }

  const handleDragEnd = () => {
    setDraggingPoint(null)
    pushToHistory()
  }

  const handleDeletePoint = (index, event) => {
    event.stopPropagation()
    pushToHistory()

    const newLines = lines.filter(([a, b]) => a !== index && b !== index)
    const adjustedLines = newLines.map(([a, b]) => [
      a > index ? a - 1 : a,
      b > index ? b - 1 : b,
    ])

    setLines(adjustedLines)
    setPoints((prev) => prev.filter((_, i) => i !== index))
  }

  const generateAndSaveShapes = () => {
    const validShapes = lines.filter(
      (shape) => shape.length === 2 && points[shape[0]] && points[shape[1]],
    )

    setShapes(validShapes)

    const clipPaths = validShapes.map(([from, to]) => {
      const p1 = points[from]
      const p2 = points[to]
      return `polygon(${p1.x}% ${p1.y}%, ${p2.x}% ${p2.y}%, 50% 50%)`
    })

    onSave(clipPaths)
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onClick={handleAddPoint}
      onMouseMove={handleDrag}
      onMouseUp={handleDragEnd}
    >
      <img src={imageUrl} alt="editor" style={imageStyle} />

      {points.map((point, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: '12px',
            height: '12px',
            backgroundColor: selectedPoints.includes(index) ? 'red' : 'green',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            cursor: 'pointer',
          }}
          onClick={(event) => {
            event.stopPropagation()
            handleConnectPoints(index)
          }}
          onDoubleClick={(event) => handleDeletePoint(index, event)}
          onMouseDown={(event) => handleDragStart(index, event)}
        />
      ))}

      {lines.map(([from, to], index) => {
        const start = points[from]
        const end = points[to]

        return start && end ? (
          <svg
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <line
              x1={`${start.x}%`}
              y1={`${start.y}%`}
              x2={`${end.x}%`}
              y2={`${end.y}%`}
              stroke="blue"
              strokeWidth="2"
            />
          </svg>
        ) : null
      })}

      {shapes.map((shape, index) => {
        const [from, to] = shape
        const p1 = points[from]
        const p2 = points[to]

        return p1 && p2 ? (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              clipPath: `polygon(${p1.x}% ${p1.y}%, ${p2.x}% ${p2.y}%, 50% 50%)`,
              backgroundColor: `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.3)`,
            }}
          />
        ) : null
      })}

      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          display: 'flex',
          gap: '10px',
          zIndex: 1000,
        }}
      >
        <button
          onClick={undo}
          disabled={history.length === 0}
          style={{
            padding: '10px 20px',
            backgroundColor: history.length ? '#f44336' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Отменить
        </button>

        <button
          onClick={generateAndSaveShapes}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Сформировать и сохранить
        </button>
      </div>
    </div>
  )
}

export default function OtherMapPage() {
  return <ShapeEditor />
}
