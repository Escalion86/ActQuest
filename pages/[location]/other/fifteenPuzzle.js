import React, { useState, useEffect } from 'react'

const PuzzleGame = () => {
  const [gridSize, setGridSize] = useState(5) // 5 или 6
  const [tiles, setTiles] = useState([])
  const [isSolved, setIsSolved] = useState(false)

  // Инициализация и перемешивание плиток
  const generateTiles = (size) => {
    const totalTiles = size * size - 1
    return [...Array(totalTiles).keys()]
      .map((n) => n + 1)
      .concat(0)
      .sort(() => Math.random() - 0.5)
  }

  // Проверка решения
  const checkSolution = () => {
    const solution = tiles.every(
      (tile, index) =>
        tile === index + 1 || (index === gridSize * gridSize - 1 && tile === 0)
    )
    setIsSolved(solution)
  }

  // Инициализация игры
  useEffect(() => {
    setTiles(generateTiles(gridSize))
    setIsSolved(false)
  }, [gridSize])

  // Проверка при изменении плиток
  useEffect(checkSolution, [tiles])

  // Проверка возможности перемещения
  const canMove = (index) => {
    const emptyIndex = tiles.indexOf(0)
    const row = Math.floor(index / gridSize)
    const emptyRow = Math.floor(emptyIndex / gridSize)

    return (
      (Math.abs(index - emptyIndex) === 1 && row === emptyRow) ||
      Math.abs(index - emptyIndex) === gridSize
    )
  }

  // Обработка клика по плитке
  const handleTileClick = (index) => {
    if (isSolved || !canMove(index)) return

    const emptyIndex = tiles.indexOf(0)
    const newTiles = [...tiles]
    ;[newTiles[index], newTiles[emptyIndex]] = [
      newTiles[emptyIndex],
      newTiles[index],
    ]

    setTiles(newTiles)
  }

  // Динамические стили для разных размеров
  const tileSize = {
    5: 'w-16 h-16 text-xl', // 64px
    6: 'w-14 h-14 text-lg', // 56px
  }[gridSize]

  return (
    <div className="flex flex-col items-center min-h-screen gap-5 p-5 bg-gray-100">
      <div className="flex gap-4">
        <button
          onClick={() => setGridSize(5)}
          className={`px-4 py-2 rounded ${
            gridSize === 5 ? 'bg-blue-600 text-white' : 'bg-gray-300'
          }`}
        >
          5x5
        </button>
        <button
          onClick={() => setGridSize(6)}
          className={`px-4 py-2 rounded ${
            gridSize === 6 ? 'bg-blue-600 text-white' : 'bg-gray-300'
          }`}
        >
          6x6
        </button>
      </div>

      <div
        className={`grid gap-1 bg-[#bbada0] p-1 rounded ${
          isSolved ? 'bg-opacity-80' : ''
        }`}
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
      >
        {tiles.map((tile, index) => (
          <button
            key={index}
            className={`${tileSize} flex items-center justify-center border-none rounded-sm font-bold 
              transition-all duration-100 cursor-pointer
              ${
                tile === 0
                  ? 'bg-transparent'
                  : `bg-[#eee4da] text-[#776e65] hover:scale-105
                 ${isSolved ? '!bg-green-400' : ''}`
              }
            `}
            onClick={() => handleTileClick(index)}
            disabled={tile === 0 || isSolved}
          >
            {tile !== 0 && tile}
          </button>
        ))}
      </div>

      {isSolved && (
        <div className="text-2xl text-[#776e65] font-bold animate-bounce">
          You Win! 🎉
        </div>
      )}

      <button
        className="px-4 py-2 text-lg bg-[#8f7a66] text-white rounded cursor-pointer
                  hover:bg-[#9c8a7a] transition-colors"
        onClick={() => setTiles(generateTiles(gridSize))}
      >
        New Game
      </button>
    </div>
  )
}

export default PuzzleGame

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params } = context
  const { id, location } = params

  // const fetchedProps = await fetchProps(session?.user)

  return {
    props: {
      // ...fetchedProps,
      id,
      location,
      // loggedUser: session?.user ?? null,
    },
  }
}
