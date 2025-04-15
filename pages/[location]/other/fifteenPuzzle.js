import React, { useState, useEffect } from 'react'

const PuzzleGame = () => {
  const [gridSize, setGridSize] = useState(4)
  const [tiles, setTiles] = useState([])
  const [isSolved, setIsSolved] = useState(false)

  // Генерация решаемой начальной позиции
  const generateSolvablePuzzle = (size) => {
    let newTiles
    let attempts = 0
    do {
      newTiles = [...Array(size * size - 1).keys()]
        .map((n) => n + 1)
        .concat(0)
        .sort(() => Math.random() - 0.5)
      attempts++
    } while (!isSolvable(newTiles, size) && attempts < 100)

    return newTiles
  }

  // Проверка на возможность решения
  const isSolvable = (tilesArray, size) => {
    const emptyIndex = tilesArray.indexOf(0)
    const emptyRow = size - Math.floor(emptyIndex / size)

    let inversions = 0
    for (let i = 0; i < tilesArray.length; i++) {
      for (let j = i + 1; j < tilesArray.length; j++) {
        if (tilesArray[i] > tilesArray[j] && tilesArray[j] !== 0) {
          inversions++
        }
      }
    }

    if (size % 2 === 1) return inversions % 2 === 0
    return (inversions + emptyRow) % 2 === 1
  }

  // Инициализация игры
  useEffect(() => {
    setTiles(generateSolvablePuzzle(gridSize))
    setIsSolved(false)
  }, [gridSize])

  // Проверка решения
  useEffect(() => {
    const solved = tiles.every(
      (tile, index) =>
        tile === index + 1 || (index === gridSize * gridSize - 1 && tile === 0)
    )
    setIsSolved(solved)
  }, [tiles])

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

  // Обработка клика
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

  // Стили для разных размеров
  const tileSize = {
    4: 'w-20 h-20 text-2xl', // 80px
    5: 'w-16 h-16 text-xl', // 64px
    6: 'w-14 h-14 text-lg', // 56px
  }[gridSize]

  const code = {
    4: '9A678Q', // 80px
    5: '9A592Q', // 64px
    6: '9A391Q', // 56px
  }[gridSize]

  return (
    <div className="flex flex-col items-center min-h-screen gap-5 p-5 bg-gray-100">
      <div className="flex gap-4 mb-4">
        {[4, 5, 6].map((size) => (
          <button
            key={size}
            onClick={() => setGridSize(size)}
            className={`px-4 py-2 rounded ${
              gridSize === size
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          >
            {size}x{size}
          </button>
        ))}
      </div>

      <div
        className={`grid gap-1 bg-[#bbada0] p-1 rounded-lg ${
          isSolved ? 'bg-opacity-80' : ''
        }`}
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
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
          Победа! 🎉
          {code}
          Попробуй другие варианты!
        </div>
      )}

      <button
        className="px-4 py-2 text-lg bg-[#8f7a66] text-white rounded-lg cursor-pointer
                  hover:bg-[#9c8a7a] transition-colors shadow-md"
        onClick={() => setTiles(generateSolvablePuzzle(gridSize))}
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
