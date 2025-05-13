import React, { useState, useRef, useEffect } from 'react'

const ShapeEditor = ({
  imageUrl = 'https://escalioncloud.ru/uploads/polovinka_uspeha/events/a3bd5d24-d5c6-45ce-b4c0-398dc324a434.jpeg',
  onSave = (e) => console.log(e),
}) => {
  const [points, setPoints] = useState([])
  const [lines, setLines] = useState([])
  const [shapes, setShapes] = useState([])
  const [history, setHistory] = useState([])
  const [selectedPoints, setSelectedPoints] = useState([])
  const [draggingPoint, setDraggingPoint] = useState(null)
  const containerRef = useRef(null)
  const aspectRatio = 3 / 4

  // Стили контейнера для сохранения соотношения 4:3
  const containerStyle = {
    position: 'relative',
    width: '100%',
    paddingTop: `${aspectRatio * 100}%`, // Сохраняем соотношение 4:3
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
  // Сохранение состояния в историю
  const pushToHistory = () => {
    setHistory((prev) => [
      ...prev,
      {
        points: [...points],
        lines: [...lines],
      },
    ])
  }

  // Отмена последнего действия
  const undo = () => {
    if (history.length === 0) return

    const newHistory = [...history]
    const lastState = newHistory.pop()

    // Восстанавливаем предыдущее состояние
    setPoints(lastState.points || [])
    setLines(lastState.lines || [])
    setShapes([]) // Сбрасываем сформированные фигуры
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

  const handleAddPoint = (e) => {
    pushToHistory()
    const pos = getRelativePosition(e.clientX, e.clientY)
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

  // Перемещение точки
  const handleDragStart = (index, e) => {
    e.stopPropagation()
    setDraggingPoint(index)
  }

  const handleDrag = (e) => {
    if (draggingPoint === null) return
    const pos = getRelativePosition(e.clientX, e.clientY)
    setPoints((prev) => prev.map((p, i) => (i === draggingPoint ? pos : p)))
  }

  const handleDragEnd = () => {
    setDraggingPoint(null)
    pushToHistory()
  }

  // Удаление точки
  const handleDeletePoint = (index, e) => {
    e.stopPropagation()
    pushToHistory()

    // Удаляем связанные линии
    const newLines = lines.filter(([a, b]) => a !== index && b !== index)

    // Обновляем индексы в оставшихся линиях
    const adjustedLines = newLines.map(([a, b]) => [
      a > index ? a - 1 : a,
      b > index ? b - 1 : b,
    ])

    setLines(adjustedLines)
    setPoints((prev) => prev.filter((_, i) => i !== index))
  }

  const generateAndSaveShapes = () => {
    try {
      // Генерируем фигуры только из линий
      const newShapes = lines.map((line) => line)

      // Фильтруем некорректные фигуры
      const validShapes = newShapes.filter(
        (shape) => shape.length === 2 && points[shape[0]] && points[shape[1]]
      )

      setShapes(validShapes)

      // Создаем clipPaths
      const clipPaths = validShapes.map(([from, to]) => {
        const p1 = points[from]
        const p2 = points[to]
        // Создаем треугольник между двумя точками и центром
        return `polygon(
          ${p1.x}% ${p1.y}%, 
          ${p2.x}% ${p2.y}%, 
          50% 50%
        )`
      })

      onSave(clipPaths)
    } catch (error) {
      console.error('Error generating shapes:', error)
    }
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

      {/* Точки */}
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
          onClick={(e) => {
            e.stopPropagation()
            handleConnectPoints(index)
          }}
          onDoubleClick={(e) => handleDeletePoint(index, e)}
          onMouseDown={(e) => handleDragStart(index, e)}
        />
      ))}

      {/* Линии */}
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
              clipPath: `polygon(
                ${p1.x}% ${p1.y}%, 
                ${p2.x}% ${p2.y}%, 
                50% 50%
              )`,
              backgroundColor: `rgba(${Math.random() * 255},${
                Math.random() * 255
              },${Math.random() * 255},0.3)`,
            }}
          />
        ) : null
      })}

      {/* Панель управления */}
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

export default ShapeEditor

const JigsawPuzzle = ({
  imageUrl = 'https://escalioncloud.ru/uploads/polovinka_uspeha/events/a3bd5d24-d5c6-45ce-b4c0-398dc324a434.jpeg',
  totalPieces = 10,
  visiblePieces = 5,
  containerWidth = 600,
}) => {
  const [pieces, setPieces] = useState([])
  const containerHeight = (containerWidth * 3) / 4
  const COLS = 20
  const ROWS = 15

  useEffect(() => {
    const generatePuzzle = () => {
      // Генерация базовой сетки треугольников
      const triangles = generateTrianglesGrid()

      // Распределение треугольников по группам
      const groups = distributeTriangles(triangles, totalPieces)

      // Формирование данных для рендеринга
      const puzzlePieces = groups.map((group, i) => ({
        id: i,
        visible: i < visiblePieces,
        polygons: group.map((t) => t.polygon),
      }))

      setPieces(puzzlePieces)
    }

    generatePuzzle()
  }, [totalPieces, visiblePieces, containerWidth])

  // Генерация треугольной сетки
  const generateTrianglesGrid = () => {
    const cellWidth = 100 / COLS
    const cellHeight = 100 / ROWS
    const triangles = []

    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const x = col * cellWidth
        const y = row * cellHeight

        // Первый треугольник ячейки
        triangles.push({
          id: `${col}-${row}-0`,
          polygon: [
            `${x}% ${y}%`,
            `${x + cellWidth}% ${y}%`,
            `${x}% ${y + cellHeight}%`,
          ],
          used: false,
        })

        // Второй треугольник ячейки
        triangles.push({
          id: `${col}-${row}-1`,
          polygon: [
            `${x + cellWidth}% ${y}%`,
            `${x + cellWidth}% ${y + cellHeight}%`,
            `${x}% ${y + cellHeight}%`,
          ],
          used: false,
        })
      }
    }
    return triangles
  }

  // Распределение треугольников по группам
  const distributeTriangles = (triangles, groupsCount) => {
    const groupSize = Math.floor(triangles.length / groupsCount)
    const groups = Array.from({ length: groupsCount }, () => [])
    let currentGroup = 0

    // Начинаем с краевых треугольников
    const edgeTriangles = triangles.filter((t) =>
      t.polygon.some(
        (p) =>
          p.includes('0%') ||
          p.includes('100%') ||
          p.split(' ')[1].includes('0%') ||
          p.split(' ')[1].includes('100%')
      )
    )

    // Распределение треугольников
    const queue = [...edgeTriangles]

    while (queue.length > 0) {
      const triangle = queue.shift()
      if (triangle.used) continue

      // Добавляем треугольник в текущую группу
      groups[currentGroup].push(triangle)
      triangle.used = true

      // Переходим к следующей группе при заполнении
      if (groups[currentGroup].length >= groupSize) {
        currentGroup = (currentGroup + 1) % groupsCount
      }

      // Добавляем соседей в очередь
      queue.push(...findNeighbors(triangle, triangles))
    }

    return groups
  }

  // Поиск соседних треугольников
  const findNeighbors = (triangle, allTriangles) => {
    return allTriangles.filter(
      (t) =>
        !t.used &&
        t.polygon.some((tp) => triangle.polygon.some((sp) => sp === tp))
    )
  }

  return (
    <div
      style={{
        width: containerWidth,
        height: containerHeight,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
      }}
    >
      <img
        src={imageUrl}
        alt="puzzle base"
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.3,
        }}
      />

      {pieces.map((piece) => (
        <div
          key={piece.id}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: piece.visible ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          {piece?.polygons?.map((polygon, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                clipPath: `polygon(${polygon.join(', ')})`,
              }}
            >
              <img
                src={imageUrl}
                alt="puzzle piece"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// export default JigsawPuzzle

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params } = context
  const { location } = params

  // const fetchedProps = await fetchProps(session?.user)

  return {
    props: {
      // ...fetchedProps,
      // id,
      location,
      // loggedUser: session?.user ?? null,
    },
  }
}
