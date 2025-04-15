import React, { useState, useEffect } from 'react'

function FifteenPuzzle(props) {
  const [tiles, setTiles] = useState([])
  const [isSolved, setIsSolved] = useState(false)

  useEffect(() => {
    shuffleTiles()
  }, [])

  useEffect(() => {
    const solved = tiles.every(
      (tile, index) => tile === index + 1 || (index === 15 && tile === 0)
    )
    setIsSolved(solved)
  }, [tiles])

  const shuffleTiles = () => {
    const newTiles = [...Array(15).keys()]
      .map((n) => n + 1)
      .concat(0)
      .sort(() => Math.random() - 0.5)

    setTiles(newTiles)
    setIsSolved(false)
  }

  const canMove = (index) => {
    const emptyIndex = tiles.indexOf(0)
    const row = Math.floor(index / 4)
    const emptyRow = Math.floor(emptyIndex / 4)

    return (
      (Math.abs(index - emptyIndex) === 1 && row === emptyRow) ||
      Math.abs(index - emptyIndex) === 4
    )
  }

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

  return (
    <div className="flex flex-col items-center gap-5 p-5">
      <div
        className={`grid grid-cols-4 gap-1 bg-[#bbada0] p-1 rounded ${
          isSolved ? 'bg-opacity-80' : ''
        }`}
      >
        {tiles.map((tile, index) => (
          <button
            key={index}
            className={`w-20 h-20 border-none rounded-sm text-2xl font-bold 
              transition-transform duration-100 cursor-pointer 
              ${
                tile === 0
                  ? 'bg-transparent shadow-none cursor-default'
                  : `bg-[#eee4da] text-[#776e65] hover:scale-105
                 ${isSolved ? '!bg-green-400' : ''}`
              }`}
            onClick={() => handleTileClick(index)}
            disabled={tile === 0 || isSolved}
          >
            {tile !== 0 && tile}
          </button>
        ))}
      </div>

      {isSolved && (
        <div className="text-2xl text-[#776e65] font-bold">You Win!</div>
      )}

      <button
        className="px-4 py-2 text-lg bg-[#8f7a66] text-white rounded cursor-pointer
                  hover:bg-[#9c8a7a] transition-colors"
        onClick={shuffleTiles}
      >
        New Game
      </button>
    </div>
  )
}

export default FifteenPuzzle

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
