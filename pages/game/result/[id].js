import { getData } from '@helpers/CRUD'
// import { getSession } from 'next-auth/react'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import getSecondsBetween from '@helpers/getSecondsBetween'
// import Image from 'next/image'
import cn from 'classnames'

const PASTEL_COLORS = [
  '#B6D8F2',
  '#CCD4BF',
  '#D0BCAC',
  '#F4CFDF',
  '#F7F6CF',
  '#9AC8EB',
  '#98D4BB',
  '#E7CBA9',
  '#EEBAB2',
  '#F5F3E7',
  '#F5BFD2',
  '#E5DB9C',
  '#F5E2E4',
  '#D0BCAC',
  '#BEB4C5',
  '#E6A57E',
  '#9AD9DB',
  '#E5DBD9',
  '#EB96AA',
  '#C6C9D0',
  '#E5B3BB',
  '#F9968B',
  '#F27348',
  '#76CDCD',
  '#7B92AA',
  '#E4CEE0',
  '#DC828F',
  '#F7CE76',
  '#E8D595',
]

// const Car = ({ name, color = '#000000' }) => (
//   <div
//     className="flex items-center justify-end gap-x-2"
//     style={{
//       height: 50,
//       width: 200,
//     }}
//   >
//     <div
//       // className="absolute top-[48%] -translate-y-1/2"
//       style={{
//         right: 70,
//         fontSize: '12px',
//         textAlign: 'right',
//         width: 130,
//         lineHeight: '10px',
//       }}
//     >
//       {name}
//     </div>
//     <svg
//       version="1.0"
//       xmlns="http://www.w3.org/2000/svg"
//       // width="1280.000000pt"
//       // height="640.000000pt"
//       width="60.000000px"
//       height="30.000000px"
//       viewBox="0 0 1280.000000 640.000000"
//       preserveAspectRatio="xMidYMid meet"
//     >
//       <metadata>
//         Created by potrace 1.15, written by Peter Selinger 2001-2017
//       </metadata>
//       <g
//         transform="translate(0.000000,640.000000) scale(0.100000,-0.100000)"
//         fill="#000000"
//         // stroke="none"
//       >
//         <path
//           fill={color}
//           stroke="#000000"
//           strokeWidth="200"
//           strokeLinecap="round"
//           d="M3565 5336 c-106 -30 -101 -26 -108 -111 -4 -42 -9 -80 -12 -85 -6
// -10 -246 -105 -590 -234 -448 -167 -1052 -415 -1173 -483 -78 -43 -193 -91
// -250 -104 -23 -5 -98 -14 -165 -19 -67 -6 -167 -19 -222 -30 -154 -31 -340
// -49 -563 -57 l-203 -6 -43 -66 c-59 -91 -60 -95 -26 -130 37 -37 38 -65 3
// -150 -25 -62 -27 -78 -31 -256 l-4 -190 -38 -32 c-91 -78 -133 -209 -134 -418
// 0 -194 11 -396 26 -482 13 -71 14 -74 72 -122 69 -58 130 -129 158 -184 64
// -126 534 -211 1384 -250 l92 -4 -6 119 c-6 142 8 256 49 383 112 352 394 622
// 756 722 90 26 112 28 278 28 165 0 188 -2 278 -27 201 -56 361 -152 504 -302
// 140 -145 222 -293 274 -492 21 -79 24 -109 23 -279 -1 -127 -6 -214 -16 -263
// l-15 -73 3006 7 c1653 4 3007 8 3009 9 1 1 -8 37 -20 81 -19 67 -22 105 -22
// 259 -1 166 1 187 27 279 117 421 467 736 885 797 119 17 325 7 432 -21 239
// -63 453 -205 601 -399 70 -92 154 -267 185 -386 24 -88 27 -119 27 -260 1
// -116 -4 -181 -16 -234 -10 -41 -16 -75 -15 -76 2 -1 62 2 133 6 266 16 458 45
// 525 79 48 24 97 81 127 146 l24 52 -16 157 c-15 152 -15 163 4 284 63 388 50
// 680 -35 802 -134 193 -526 336 -1429 519 -737 149 -1322 209 -2033 210 -228 0
// -226 0 -347 85 -187 131 -1045 607 -1471 815 -383 187 -788 281 -1439 332
// -208 17 -1106 16 -1400 0 -121 -7 -314 -19 -430 -27 -302 -22 -286 -22 -341
// 10 -140 81 -187 94 -269 71z m1885 -333 c6 -37 38 -238 71 -446 32 -209 66
// -422 75 -474 9 -52 15 -96 13 -97 -11 -9 -1699 29 -1951 44 -206 13 -417 36
// -485 54 -98 26 -198 119 -249 231 -35 75 -36 172 -5 255 17 45 30 61 68 86 83
// 54 135 80 253 127 341 136 858 230 1460 267 269 16 270 16 511 18 l227 2 12
// -67z m630 47 c264 -18 777 -110 1029 -186 186 -56 445 -188 756 -387 211 -134
// 274 -181 250 -185 -75 -12 -133 -50 -162 -106 -19 -35 -21 -136 -4 -179 l11
// -27 -907 2 -906 3 -59 160 c-110 302 -298 878 -298 916 0 6 95 2 290 -11z"
//         />
//         <path
//           d="M2633 3125 c-223 -40 -410 -141 -568 -306 -132 -138 -213 -283 -262
// -467 -22 -83 -26 -119 -26 -247 -1 -169 10 -236 65 -382 87 -230 271 -436 493
// -551 85 -44 178 -78 271 -98 107 -23 312 -23 419 1 392 84 699 375 802 761 23
// 86 26 120 27 254 1 158 -5 199 -46 330 -98 310 -355 567 -668 669 -150 50
// -354 64 -507 36z m350 -301 c249 -56 457 -247 543 -499 25 -72 28 -95 28 -220
// 1 -153 -15 -228 -74 -345 -94 -186 -283 -337 -485 -386 -96 -24 -268 -24 -360
// 0 -320 84 -544 355 -562 681 -20 359 209 673 558 765 94 24 253 26 352 4z"
//         />
//         <path
//           d="M2600 2697 c-36 -13 -85 -36 -109 -51 l-44 -28 116 -115 c81 -82 120
// -114 131 -110 14 6 16 29 16 167 0 186 6 178 -110 137z"
//         />
//         <path
//           d="M2920 2561 c0 -139 2 -162 16 -168 11 -4 50 28 130 108 l115 114 -28
// 22 c-34 28 -138 70 -193 79 l-40 7 0 -162z"
//         />
//         <path
//           d="M2282 2448 c-28 -36 -92 -191 -92 -225 0 -10 34 -13 165 -13 151 0
// 165 1 165 18 0 15 -206 232 -221 232 -4 0 -11 -6 -17 -12z"
//         />
//         <path
//           d="M3222 2351 c-62 -59 -112 -115 -112 -124 0 -15 17 -17 165 -17 131 0
// 165 3 165 13 0 40 -69 205 -95 227 -7 6 -48 -27 -123 -99z"
//         />
//         <path
//           d="M2781 2332 c-12 -22 11 -62 34 -62 8 0 21 10 29 22 20 28 4 58 -29
// 58 -13 0 -29 -8 -34 -18z"
//         />
//         <path
//           d="M2749 2161 c-32 -33 -37 -67 -14 -110 29 -57 104 -64 151 -14 53 57
// 9 153 -71 153 -27 0 -44 -8 -66 -29z"
//         />
//         <path
//           d="M2570 2125 c-26 -32 13 -81 48 -59 24 16 27 45 6 61 -23 17 -39 16
// -54 -2z"
//         />
//         <path
//           d="M3006 2124 c-20 -19 -20 -38 -2 -54 23 -19 61 -8 64 18 7 44 -32 67
// -62 36z"
//         />
//         <path
//           d="M2190 1975 c0 -29 41 -140 72 -194 l31 -53 117 117 c71 71 116 123
// 113 131 -4 11 -40 14 -169 14 -141 0 -164 -2 -164 -15z"
//         />
//         <path
//           d="M3110 1972 c0 -9 51 -68 114 -131 l114 -114 31 54 c30 51 71 165 71
// 195 0 11 -31 14 -165 14 -151 0 -165 -1 -165 -18z"
//         />
//         <path
//           d="M2780 1901 c-7 -15 -5 -24 8 -41 32 -40 85 -4 62 41 -14 25 -56 25
// -70 0z"
//         />
//         <path
//           d="M2562 1697 c-61 -62 -112 -115 -112 -119 0 -18 208 -108 249 -108 7
// 0 11 54 11 164 0 140 -2 165 -16 170 -9 3 -16 6 -17 6 -1 0 -53 -51 -115 -113z"
//         />
//         <path
//           d="M2933 1803 c-15 -6 -19 -333 -4 -333 46 0 251 88 251 108 0 9 -223
// 232 -230 231 -3 0 -11 -3 -17 -6z"
//         />
//         <path
//           d="M10700 3119 c-390 -84 -696 -376 -797 -759 -31 -117 -41 -292 -24
// -411 33 -227 150 -453 318 -609 267 -250 643 -344 993 -249 117 32 283 118
// 380 196 487 396 518 1128 67 1560 -97 93 -166 140 -290 198 -137 64 -235 86
// -407 91 -120 3 -162 0 -240 -17z m445 -313 c238 -81 409 -258 486 -506 30 -96
// 33 -289 5 -388 -110 -400 -513 -637 -911 -536 -149 38 -313 147 -402 267 -176
// 238 -203 533 -71 797 34 69 60 103 138 180 77 78 111 104 181 139 129 65 207
// 81 364 77 109 -3 143 -7 210 -30z"
//         />
//         <path
//           d="M10703 2700 c-54 -19 -153 -71 -153 -80 0 -3 51 -57 114 -119 80 -80
// 119 -112 130 -108 14 5 16 29 16 167 l0 160 -27 -1 c-16 0 -52 -9 -80 -19z"
//         />
//         <path
//           d="M11020 2561 c0 -139 2 -162 16 -168 22 -8 247 216 234 232 -17 20
// -163 84 -207 91 l-43 7 0 -162z"
//         />
//         <path
//           d="M10366 2424 c-29 -44 -76 -165 -76 -194 0 -19 7 -20 165 -20 126 0
// 165 3 165 13 0 7 -51 63 -114 126 l-114 114 -26 -39z"
//         />
//         <path
//           d="M11313 2348 c-61 -62 -109 -119 -106 -125 6 -15 333 -19 333 -4 0 45
// -88 241 -108 241 -4 0 -57 -51 -119 -112z"
//         />
//         <path
//           d="M10882 2338 c-17 -17 -15 -32 7 -52 16 -14 23 -15 41 -6 31 17 24 64
// -10 68 -14 2 -31 -3 -38 -10z"
//         />
//         <path
//           d="M10846 2159 c-68 -81 17 -194 110 -144 89 48 56 175 -46 175 -30 0
// -44 -6 -64 -31z"
//         />
//         <path
//           d="M10670 2126 c-19 -23 -8 -61 18 -64 44 -7 67 32 36 62 -19 20 -38 20
// -54 2z"
//         />
//         <path
//           d="M11106 2127 c-21 -16 -18 -45 7 -61 37 -23 77 35 41 61 -10 7 -21 13
// -24 13 -3 0 -14 -6 -24 -13z"
//         />
//         <path
//           d="M10290 1970 c0 -29 43 -141 74 -195 l28 -48 116 116 c81 81 113 120
// 109 131 -6 14 -29 16 -167 16 -152 0 -160 -1 -160 -20z"
//         />
//         <path
//           d="M11207 1978 c-3 -7 47 -66 111 -130 l116 -118 27 43 c27 44 79 177
// 79 203 0 12 -28 14 -164 14 -122 0 -166 -3 -169 -12z"
//         />
//         <path
//           d="M10881 1901 c-14 -25 -5 -48 20 -56 27 -9 51 13 47 44 -4 34 -51 43
// -67 12z"
//         />
//         <path
//           d="M10662 1697 c-61 -62 -112 -115 -112 -119 0 -20 201 -108 247 -108
// 10 0 13 34 13 164 0 140 -2 165 -16 170 -9 3 -16 6 -17 6 -1 0 -53 -51 -115
// -113z"
//         />
//         <path
//           d="M11033 1803 c-10 -3 -13 -47 -13 -169 0 -90 4 -164 8 -164 36 0 186
// 61 239 98 16 10 -216 242 -234 235z"
//         />
//       </g>
//     </svg>
//   </div>
// )
const Car = ({ name, color = '#000000', rowHeight }) => (
  <div
    className="flex flex-col items-end justify-end gap-x-2"
    style={{
      height: rowHeight,
      width: 200,
    }}
  >
    <svg
      version="1.0"
      xmlns="http://www.w3.org/2000/svg"
      // width="1280.000000pt"
      // height="640.000000pt"
      width="80.000000px"
      height="40.000000px"
      viewBox="0 0 1280.000000 640.000000"
      preserveAspectRatio="xMidYMid meet"
    >
      <metadata>
        Created by potrace 1.15, written by Peter Selinger 2001-2017
      </metadata>
      <g
        transform="translate(0.000000,640.000000) scale(0.100000,-0.100000)"
        fill="#000000"
        // stroke="none"
      >
        <path
          fill={color}
          stroke="#000000"
          strokeWidth="200"
          strokeLinecap="round"
          d="M3565 5336 c-106 -30 -101 -26 -108 -111 -4 -42 -9 -80 -12 -85 -6
-10 -246 -105 -590 -234 -448 -167 -1052 -415 -1173 -483 -78 -43 -193 -91
-250 -104 -23 -5 -98 -14 -165 -19 -67 -6 -167 -19 -222 -30 -154 -31 -340
-49 -563 -57 l-203 -6 -43 -66 c-59 -91 -60 -95 -26 -130 37 -37 38 -65 3
-150 -25 -62 -27 -78 -31 -256 l-4 -190 -38 -32 c-91 -78 -133 -209 -134 -418
0 -194 11 -396 26 -482 13 -71 14 -74 72 -122 69 -58 130 -129 158 -184 64
-126 534 -211 1384 -250 l92 -4 -6 119 c-6 142 8 256 49 383 112 352 394 622
756 722 90 26 112 28 278 28 165 0 188 -2 278 -27 201 -56 361 -152 504 -302
140 -145 222 -293 274 -492 21 -79 24 -109 23 -279 -1 -127 -6 -214 -16 -263
l-15 -73 3006 7 c1653 4 3007 8 3009 9 1 1 -8 37 -20 81 -19 67 -22 105 -22
259 -1 166 1 187 27 279 117 421 467 736 885 797 119 17 325 7 432 -21 239
-63 453 -205 601 -399 70 -92 154 -267 185 -386 24 -88 27 -119 27 -260 1
-116 -4 -181 -16 -234 -10 -41 -16 -75 -15 -76 2 -1 62 2 133 6 266 16 458 45
525 79 48 24 97 81 127 146 l24 52 -16 157 c-15 152 -15 163 4 284 63 388 50
680 -35 802 -134 193 -526 336 -1429 519 -737 149 -1322 209 -2033 210 -228 0
-226 0 -347 85 -187 131 -1045 607 -1471 815 -383 187 -788 281 -1439 332
-208 17 -1106 16 -1400 0 -121 -7 -314 -19 -430 -27 -302 -22 -286 -22 -341
10 -140 81 -187 94 -269 71z m1885 -333 c6 -37 38 -238 71 -446 32 -209 66
-422 75 -474 9 -52 15 -96 13 -97 -11 -9 -1699 29 -1951 44 -206 13 -417 36
-485 54 -98 26 -198 119 -249 231 -35 75 -36 172 -5 255 17 45 30 61 68 86 83
54 135 80 253 127 341 136 858 230 1460 267 269 16 270 16 511 18 l227 2 12
-67z m630 47 c264 -18 777 -110 1029 -186 186 -56 445 -188 756 -387 211 -134
274 -181 250 -185 -75 -12 -133 -50 -162 -106 -19 -35 -21 -136 -4 -179 l11
-27 -907 2 -906 3 -59 160 c-110 302 -298 878 -298 916 0 6 95 2 290 -11z"
        />
        <path
          d="M2633 3125 c-223 -40 -410 -141 -568 -306 -132 -138 -213 -283 -262
-467 -22 -83 -26 -119 -26 -247 -1 -169 10 -236 65 -382 87 -230 271 -436 493
-551 85 -44 178 -78 271 -98 107 -23 312 -23 419 1 392 84 699 375 802 761 23
86 26 120 27 254 1 158 -5 199 -46 330 -98 310 -355 567 -668 669 -150 50
-354 64 -507 36z m350 -301 c249 -56 457 -247 543 -499 25 -72 28 -95 28 -220
1 -153 -15 -228 -74 -345 -94 -186 -283 -337 -485 -386 -96 -24 -268 -24 -360
0 -320 84 -544 355 -562 681 -20 359 209 673 558 765 94 24 253 26 352 4z"
        />
        <path
          d="M2600 2697 c-36 -13 -85 -36 -109 -51 l-44 -28 116 -115 c81 -82 120
-114 131 -110 14 6 16 29 16 167 0 186 6 178 -110 137z"
        />
        <path
          d="M2920 2561 c0 -139 2 -162 16 -168 11 -4 50 28 130 108 l115 114 -28
22 c-34 28 -138 70 -193 79 l-40 7 0 -162z"
        />
        <path
          d="M2282 2448 c-28 -36 -92 -191 -92 -225 0 -10 34 -13 165 -13 151 0
165 1 165 18 0 15 -206 232 -221 232 -4 0 -11 -6 -17 -12z"
        />
        <path
          d="M3222 2351 c-62 -59 -112 -115 -112 -124 0 -15 17 -17 165 -17 131 0
165 3 165 13 0 40 -69 205 -95 227 -7 6 -48 -27 -123 -99z"
        />
        <path
          d="M2781 2332 c-12 -22 11 -62 34 -62 8 0 21 10 29 22 20 28 4 58 -29
58 -13 0 -29 -8 -34 -18z"
        />
        <path
          d="M2749 2161 c-32 -33 -37 -67 -14 -110 29 -57 104 -64 151 -14 53 57
9 153 -71 153 -27 0 -44 -8 -66 -29z"
        />
        <path
          d="M2570 2125 c-26 -32 13 -81 48 -59 24 16 27 45 6 61 -23 17 -39 16
-54 -2z"
        />
        <path
          d="M3006 2124 c-20 -19 -20 -38 -2 -54 23 -19 61 -8 64 18 7 44 -32 67
-62 36z"
        />
        <path
          d="M2190 1975 c0 -29 41 -140 72 -194 l31 -53 117 117 c71 71 116 123
113 131 -4 11 -40 14 -169 14 -141 0 -164 -2 -164 -15z"
        />
        <path
          d="M3110 1972 c0 -9 51 -68 114 -131 l114 -114 31 54 c30 51 71 165 71
195 0 11 -31 14 -165 14 -151 0 -165 -1 -165 -18z"
        />
        <path
          d="M2780 1901 c-7 -15 -5 -24 8 -41 32 -40 85 -4 62 41 -14 25 -56 25
-70 0z"
        />
        <path
          d="M2562 1697 c-61 -62 -112 -115 -112 -119 0 -18 208 -108 249 -108 7
0 11 54 11 164 0 140 -2 165 -16 170 -9 3 -16 6 -17 6 -1 0 -53 -51 -115 -113z"
        />
        <path
          d="M2933 1803 c-15 -6 -19 -333 -4 -333 46 0 251 88 251 108 0 9 -223
232 -230 231 -3 0 -11 -3 -17 -6z"
        />
        <path
          d="M10700 3119 c-390 -84 -696 -376 -797 -759 -31 -117 -41 -292 -24
-411 33 -227 150 -453 318 -609 267 -250 643 -344 993 -249 117 32 283 118
380 196 487 396 518 1128 67 1560 -97 93 -166 140 -290 198 -137 64 -235 86
-407 91 -120 3 -162 0 -240 -17z m445 -313 c238 -81 409 -258 486 -506 30 -96
33 -289 5 -388 -110 -400 -513 -637 -911 -536 -149 38 -313 147 -402 267 -176
238 -203 533 -71 797 34 69 60 103 138 180 77 78 111 104 181 139 129 65 207
81 364 77 109 -3 143 -7 210 -30z"
        />
        <path
          d="M10703 2700 c-54 -19 -153 -71 -153 -80 0 -3 51 -57 114 -119 80 -80
119 -112 130 -108 14 5 16 29 16 167 l0 160 -27 -1 c-16 0 -52 -9 -80 -19z"
        />
        <path
          d="M11020 2561 c0 -139 2 -162 16 -168 22 -8 247 216 234 232 -17 20
-163 84 -207 91 l-43 7 0 -162z"
        />
        <path
          d="M10366 2424 c-29 -44 -76 -165 -76 -194 0 -19 7 -20 165 -20 126 0
165 3 165 13 0 7 -51 63 -114 126 l-114 114 -26 -39z"
        />
        <path
          d="M11313 2348 c-61 -62 -109 -119 -106 -125 6 -15 333 -19 333 -4 0 45
-88 241 -108 241 -4 0 -57 -51 -119 -112z"
        />
        <path
          d="M10882 2338 c-17 -17 -15 -32 7 -52 16 -14 23 -15 41 -6 31 17 24 64
-10 68 -14 2 -31 -3 -38 -10z"
        />
        <path
          d="M10846 2159 c-68 -81 17 -194 110 -144 89 48 56 175 -46 175 -30 0
-44 -6 -64 -31z"
        />
        <path
          d="M10670 2126 c-19 -23 -8 -61 18 -64 44 -7 67 32 36 62 -19 20 -38 20
-54 2z"
        />
        <path
          d="M11106 2127 c-21 -16 -18 -45 7 -61 37 -23 77 35 41 61 -10 7 -21 13
-24 13 -3 0 -14 -6 -24 -13z"
        />
        <path
          d="M10290 1970 c0 -29 43 -141 74 -195 l28 -48 116 116 c81 81 113 120
109 131 -6 14 -29 16 -167 16 -152 0 -160 -1 -160 -20z"
        />
        <path
          d="M11207 1978 c-3 -7 47 -66 111 -130 l116 -118 27 43 c27 44 79 177
79 203 0 12 -28 14 -164 14 -122 0 -166 -3 -169 -12z"
        />
        <path
          d="M10881 1901 c-14 -25 -5 -48 20 -56 27 -9 51 13 47 44 -4 34 -51 43
-67 12z"
        />
        <path
          d="M10662 1697 c-61 -62 -112 -115 -112 -119 0 -20 201 -108 247 -108
10 0 13 34 13 164 0 140 -2 165 -16 170 -9 3 -16 6 -17 6 -1 0 -53 -51 -115
-113z"
        />
        <path
          d="M11033 1803 c-10 -3 -13 -47 -13 -169 0 -90 4 -164 8 -164 36 0 186
61 239 98 16 10 -216 242 -234 235z"
        />
      </g>
    </svg>
    <div
      className="-mt-0.5 text-right whitespace-nowrap"
      style={{
        right: 70,
        fontSize: '12px',
        textAlign: 'right',
        // width: 130,
        lineHeight: '10px',
      }}
    >
      {name ?? '???'}
    </div>
  </div>
)

const toHHMMSS = (seconds, noHours = false) => {
  var sec_num = parseInt(seconds, 10) // don't forget the second param
  var hours = Math.floor(sec_num / 3600)
  var minutes = Math.floor((sec_num - hours * 3600) / 60)
  var seconds = sec_num - hours * 3600 - minutes * 60

  if (hours < 10) {
    hours = '0' + hours
  }
  if (minutes < 10) {
    minutes = '0' + minutes
  }
  if (seconds < 10) {
    seconds = '0' + seconds
  }
  return (
    (noHours && hours === '00' ? '' : hours + ':') + minutes + ':' + seconds
  )
}

const Time = ({ start, seconds, duration }) => {
  const [time, setTime] = useState(0)
  const [interval, setIntervalState] = useState(null)

  useEffect(() => {
    if (start) {
      setIntervalState(
        setInterval(() => {
          setTime((state) => state + seconds / (duration * 10))
        }, 100)
      )
    } else {
      clearInterval(interval)
      setIntervalState(null)
      setTime(0)
    }
  }, [start, seconds])

  useEffect(() => {
    if (interval && time >= seconds) {
      setTime(seconds)
      clearInterval(interval)
      setIntervalState(null)
    }
  }, [time, seconds, interval])

  return <div>{toHHMMSS(time)}</div>
}

const TimeResult = ({
  start,
  delay,
  timeResult,
  color,
  penalty,
  bonus,
  rowHeight,
  ...props
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{
      opacity: start ? [0, 0, 1, 1] : 0,
    }}
    transition={{
      // type: 'just',
      ease: 'linear',
      // type: 'spring',
      // stiffness: 1,
      // duration: start ? duration : 0,
      delay: start ? delay : 0,
    }}
    className={cn(
      'flex flex-col font-bold w-[120px] items-center justify-center',
      color === 'red'
        ? 'text-red-600'
        : color === 'blue'
        ? 'text-blue-700'
        : color === 'green'
        ? 'text-green-800'
        : ''
    )}
    style={{
      height: rowHeight,
      minHeight: rowHeight,
    }}
    {...props}
  >
    {toHHMMSS(timeResult)}
    {(penalty > 0 || bonus > 0) && (
      <div className="flex gap-x-2 -mt-1.5 -mb-[9px] text-xs font-normal ">
        {penalty > 0 && (
          <div className="text-red-600">{toHHMMSS(penalty, true)}</div>
        )}
        {bonus > 0 && (
          <div className="text-green-800">{toHHMMSS(bonus, true)}</div>
        )}
      </div>
    )}
  </motion.div>
)

const GameBlock = ({ game }) => {
  if (!game) return null
  console.log('game :>> ', game)
  const [start, setStart] = useState(false)
  const [duration, setDuration] = useState(40) //totalSeconds / 100

  const { result, tasks } = game
  console.log('result :>> ', result)
  const { gameTeams, teamsUsers, teams } = result

  const gameTeamsWithTeams = gameTeams.map((gameTeam) => ({
    ...gameTeam,
    team: teams.find((team) => team._id === gameTeam.teamId),
  }))

  const totalSeconds = getSecondsBetween(game.dateStartFact, game.dateEndFact)

  const tableTitleHeight = 60
  const rowHeight = 60
  const taskDuration = game.taskDuration ?? 3600
  const cluesDuration = game.cluesDuration ?? 1200
  const taskFailurePenalty = game.taskFailurePenalty ?? 0

  const teamsAnimateSteps = gameTeams.map(({ startTime, endTime }, index) => {
    const tempResult = []
    for (let i = 0; i < tasks.length; i++) {
      const prevSum = i === 0 ? 0 : tempResult[i - 1]
      if (!endTime[i] || !startTime[i]) tempResult.push(prevSum + taskDuration)
      else
        tempResult.push(prevSum + getSecondsBetween(startTime[i], endTime[i]))
    }
    return tempResult
  })

  const preparedTeamsAnimateSteps = teamsAnimateSteps.map((item) =>
    item.map((el) => {
      if (el * 0.99 > totalSeconds) return 0.99
      return (el * 0.99) / totalSeconds
    })
  )

  const teamsTaskPenalty = gameTeams.map(
    ({ findedPenaltyCodes, startTime, endTime }, index) => {
      const tempResult = Array(tasks.length).fill(0)
      if (findedPenaltyCodes?.length > 0) {
        for (let i = 0; i < findedPenaltyCodes.length; i++) {
          if (findedPenaltyCodes[i]?.length > 0) {
            const codes = findedPenaltyCodes[i].map((code) =>
              code.toLowerCase()
            )
            const penalty = tasks[i].penaltyCodes
              .filter(({ code }) => {
                return codes.includes(code.toLowerCase())
              })
              .reduce((sum, { penalty }) => sum + penalty, 0)
            tempResult[i] += penalty
          }
        }
      }
      if (taskFailurePenalty) {
        for (let i = 0; i < tasks.length; i++) {
          if (!endTime[i] || !startTime[i]) {
            tempResult[i] += taskFailurePenalty
          }
        }
      }
      return tempResult
    }
  )

  const teamsTaskBonus = gameTeams.map(({ findedBonusCodes }, index) => {
    const tempResult = []
    if (findedBonusCodes?.length > 0) {
      for (let i = 0; i < findedBonusCodes.length; i++) {
        if (findedBonusCodes[i]?.length > 0) {
          const codes = findedBonusCodes[i].map((code) => code.toLowerCase())
          const bonus = tasks[i].bonusCodes
            .filter(({ code }) => {
              return codes.includes(code.toLowerCase())
            })
            .reduce((sum, { bonus }) => sum + bonus, 0)
          tempResult.push(bonus)
        } else {
          tempResult.push(0)
        }
      }
    }
    return tempResult
  })

  const totalPenalty = teamsTaskPenalty.map((penaltyArray) =>
    penaltyArray.reduce((sum, penalty) => sum + penalty, 0)
  )
  const totalBonus = teamsTaskBonus.map((bonusArray) =>
    bonusArray.reduce((sum, bonus) => sum + bonus, 0)
  )

  const totalTeamsTime = teamsAnimateSteps.map(
    (timeArray) => timeArray[timeArray.length - 1]
  )

  const totalTeamsTimeWithBonusAndPenalty = totalTeamsTime.map(
    (totalTime, index) => totalTime + totalPenalty[index] - totalBonus[index]
  )

  const orderPlaces = totalTeamsTimeWithBonusAndPenalty.map(
    (time) =>
      totalTeamsTimeWithBonusAndPenalty.filter((totalTime) => totalTime <= time)
        .length
  )

  return (
    <div className="relative">
      <div className="relative z-50 overflow-x-auto">
        <div className="fixed w-full pt-5">
          <div className="font-bold text-center h-[30px]">{game.name}</div>
          <div className="flex items-center justify-center mb-2 gap-x-2">
            <div className="text-xs tablet:text-sm">Скорость демонстрации:</div>
            <select
              className="px-2 py-1"
              value={String(duration)}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value={10}>Быстро</option>
              <option value={40}>Нормально</option>
              <option value={80}>Медленно</option>
            </select>
            <div
              className="px-2 py-1 duration-300 border border-black rounded cursor-pointer w-fit bg-violet-300 hover:bg-violet-500"
              onClick={() => setStart((state) => !state)}
            >
              {start ? 'Сброс' : 'Старт'}
            </div>
          </div>
          <div className="flex justify-center mb-2">
            <Time start={start} seconds={totalSeconds} duration={duration} />
          </div>
        </div>
        <div
          className="p-5 mt-[100px] -translate-x-[20%] tablet:-translate-x-[10%] laptop:translate-x-0 -translate-y-[19%] tablet:-translate-y-[12%] laptop:translate-y-0 scale-[60%] tablet:scale-75 laptop:scale-100"
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            height: gameTeamsWithTeams.length * rowHeight + 100,
          }}
        >
          <div
            style={{
              height: '100%',
              width: 200,
              minWidth: 200,
              borderRight: '1px solid',
            }}
          >
            <div
              style={{
                borderRight: '1px solid',
                height: '100%',
                width: '100%',
              }}
            >
              <div
                className="flex flex-col items-center px-1 font-bold"
                style={{
                  width: '100%',
                  borderBottom: '1px solid',
                  lineHeight: '10px',
                  fontSize: '12px',
                  textAlign: 'center',
                  height: tableTitleHeight,
                  minHeight: tableTitleHeight,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  // marginBottom: tableTitleHeight - 40,
                }}
              >
                Команды
              </div>
              {gameTeamsWithTeams.map(({ team }, index) => {
                return (
                  <motion.div
                    key={'order' + index}
                    animate={{
                      opacity: start ? [0, 0, 1] : 0,
                    }}
                    transition={{
                      ease: 'linear',
                      duration: start ? duration : 0,
                      times: start ? [0, 0.99, 1] : 0,
                    }}
                    className="flex items-center justify-center w-full text-lg leading-5 text-center"
                    style={{
                      height: rowHeight,
                      minHeight: rowHeight,
                    }}
                  >
                    {/* <Image
                    height={30}
                    width={30}
                    src={`/img/medals/${place}.svg`}
                  /> */}
                    {team?.name}
                  </motion.div>
                )
              })}
            </div>
          </div>
          {tasks.map(({ title }, index) => (
            <div
              key={'task' + index}
              style={{
                height: '100%',
                width: 120,
                minWidth: 120,
              }}
            >
              <div
                style={{
                  borderRight: '1px solid',
                  height: '100%',
                  width: '100%',
                }}
              >
                <div
                  className="px-1 leading-3"
                  style={{
                    width: '100%',
                    borderBottom: '1px solid',
                    fontSize: '12px',
                    textAlign: 'center',
                    height: tableTitleHeight,
                    minHeight: tableTitleHeight,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    // marginBottom: tableTitleHeight - 40,
                  }}
                >
                  {title}
                </div>
                {teamsAnimateSteps.map((timeResults, i) => {
                  const time = timeResults[index]
                  const timeResult =
                    time - (index > 0 ? timeResults[index - 1] : 0)
                  const delay =
                    time / totalSeconds > 1
                      ? duration
                      : (time / totalSeconds) * duration
                  const clues =
                    cluesDuration > 0
                      ? Math.floor(timeResult / cluesDuration)
                      : null

                  return (
                    <TimeResult
                      key={'team' + i + 'task' + index}
                      start={start}
                      delay={delay}
                      timeResult={timeResult}
                      color={
                        timeResult >= taskDuration
                          ? 'red'
                          : clues === 0
                          ? 'green'
                          : clues === 1
                          ? 'blue'
                          : ''
                      }
                      penalty={teamsTaskPenalty[i][index]}
                      bonus={teamsTaskBonus[i][index]}
                      rowHeight={rowHeight}
                    />
                  )
                })}
              </div>
            </div>
          ))}
          <div
            style={{
              height: '100%',
              width: 30,
              minWidth: 30,
            }}
          >
            {/* <div
        className="absolute top-0 bottom-0 w-full bg-repeat opacity-30"
        style={{
          background: 'url("/img/asfalt.jpg")',
          backgroundSize: '10%',
          // backgroundColor: '#000000',
          // backgroundOpacity: 2,
          // filter: 'alpha(opacity=60)',
        }}
      /> */}
            <div
              className="bg-repeat "
              style={{
                borderRight: '1px solid',
                height: '100%',
                width: '100%',
                background: 'url("/img/finish.jpg")',
                backgroundSize: '34%',
              }}
            />
          </div>
          <div
            style={{
              height: '100%',
              width: 120,
              minWidth: 120,
            }}
          >
            <div
              style={{
                borderRight: '1px solid',
                height: '100%',
                width: '100%',
              }}
            >
              <div
                className="px-1 font-bold"
                style={{
                  width: '100%',
                  borderBottom: '1px solid',
                  lineHeight: '10px',
                  fontSize: '12px',
                  textAlign: 'center',
                  height: tableTitleHeight,
                  minHeight: tableTitleHeight,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  // marginBottom: tableTitleHeight - 40,
                }}
              >
                РЕЗУЛЬТАТ
              </div>
              {totalTeamsTime.map((timeResult, index) => {
                const delay =
                  timeResult / totalSeconds > 1
                    ? duration
                    : (timeResult / totalSeconds) * duration
                return (
                  <TimeResult
                    key={'team' + index + 'result'}
                    start={start}
                    delay={delay}
                    timeResult={timeResult}
                    penalty={totalPenalty[index]}
                    bonus={totalBonus[index]}
                    rowHeight={rowHeight}
                  />
                )
              })}
            </div>
          </div>
          <div
            style={{
              height: '100%',
              width: 120,
              minWidth: 120,
            }}
          >
            <div
              style={{
                borderRight: '1px solid',
                height: '100%',
                width: '100%',
              }}
            >
              <div
                className="flex flex-col items-center px-1 font-bold"
                style={{
                  width: '100%',
                  borderBottom: '1px solid',
                  lineHeight: '10px',
                  fontSize: '12px',
                  textAlign: 'center',
                  height: tableTitleHeight,
                  minHeight: tableTitleHeight,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  // marginBottom: tableTitleHeight - 40,
                }}
              >
                ИТОГО
                <span className="text-xs leading-[10px]">
                  с учетом бонусов и штрафов
                </span>
                <span className="text-xs text-red-800 leading-[10px]">
                  (отставание от предыдущего)
                </span>
              </div>
              {totalTeamsTimeWithBonusAndPenalty.map((timeResult, index) => {
                // const delay =
                //   totalTeamsTime[index] / totalSeconds > 1
                //     ? duration
                //     : (totalTeamsTime[index] / totalSeconds) * duration
                const order = orderPlaces[index]
                const prevOrderTeamIndex =
                  orderPlaces[index] > 1
                    ? orderPlaces.findIndex((o) => o === order - 1)
                    : 0
                const prevTime =
                  totalTeamsTimeWithBonusAndPenalty[prevOrderTeamIndex]
                return (
                  <TimeResult
                    key={'team' + index + 'result'}
                    start={start}
                    delay={duration}
                    timeResult={timeResult}
                    rowHeight={rowHeight}
                    penalty={
                      orderPlaces[index] > 1 ? timeResult - prevTime : undefined
                    }
                  />
                )
              })}
            </div>
          </div>
          <div
            className="flex flex-col items-end"
            style={{
              height: '100%',
              width: 240,
              minWidth: 240,
              paddingTop: tableTitleHeight,
              // borderRight: '1px solid',
            }}
          >
            {orderPlaces.map((place, index) => {
              // if (place === 1 || place === 2 || place === 3)
              // const time =
              //   preparedTeamsAnimateSteps[index][
              //     preparedTeamsAnimateSteps[index].length - 1
              //   ] > 0.99
              //     ? 0.99
              //     : preparedTeamsAnimateSteps[index][
              //         preparedTeamsAnimateSteps[index].length - 1
              //       ]
              return (
                <motion.div
                  key={'order' + index}
                  animate={{
                    opacity: start ? [0, 0, 1] : 0,
                  }}
                  transition={{
                    // type: 'just',
                    ease: 'linear',
                    // type: 'spring',
                    // stiffness: 1,
                    duration: start ? duration : 0,
                    times: start ? [0, 0.99, 1] : 0,
                  }}
                  className={cn(
                    'w-[50px] flex items-center justify-center',
                    place <= 3 ? 'font-bold text-4xl' : 'text-3xl'
                  )}
                  style={{
                    height: rowHeight,
                    minHeight: rowHeight,
                  }}
                >
                  {/* <Image
                      height={30}
                      width={30}
                      src={`/img/medals/${place}.svg`}
                    /> */}
                  {place}
                </motion.div>
              )
              // return <div className="min-h-[50px]" />
            })}
          </div>
          {gameTeamsWithTeams.map(({ team }, index) => {
            const finalStep =
              preparedTeamsAnimateSteps[index][
                preparedTeamsAnimateSteps[index].length - 1
              ] * 1.01
            return (
              <motion.div
                key={'car' + index}
                className="z-10 flex items-center"
                style={{
                  position: 'absolute',
                  top: rowHeight * index + tableTitleHeight + 20,
                }}
                animate={{
                  x: start
                    ? [
                        0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200,
                        1650,
                      ]
                    : 0,
                }}
                transition={{
                  // type: 'just',
                  ease: 'linear',
                  // type: 'spring',
                  // stiffness: 1,
                  duration: start ? duration : 0,
                  times: start
                    ? [
                        0,
                        ...preparedTeamsAnimateSteps[index],
                        finalStep > 1 ? 1 : finalStep,
                      ]
                    : 0,
                }}
              >
                <Car
                  name={team?.name}
                  color={PASTEL_COLORS[index]}
                  rowHeight={rowHeight}
                />
              </motion.div>
            )
          })}
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 w-full bg-repeat opacity-30"
        style={{
          background: 'url("/img/asfalt.jpg")',
          backgroundSize: '10%',
          // backgroundColor: '#000000',
          // backgroundOpacity: 2,
          // filter: 'alpha(opacity=60)',
        }}
      />
    </div>
  )
}

function EventPage(props) {
  const gameId = props.id
  const [game, setGame] = useState()

  useEffect(() => {
    const getGame = async (gameId) => {
      const game = await getData('/api/games/' + gameId)
      setGame(game.data)
    }
    if (gameId) getGame(gameId)
  }, [])

  return (
    <>
      <Head>
        <title>{`ActQuest - Игра`}</title>
      </Head>
      {/* <StateLoader {...props}>
        <Header /> */}
      {game && <GameBlock game={game} />}
      {/* </StateLoader> */}
    </>
  )
}

export default EventPage

// export const getStaticPaths = async () => {
//   console.log('getStaticPaths fetching...')
//   const courses = await fetchingCourses(null, 'http://localhost:3000')
//   const chapters = await fetchingChapters(null, 'http://localhost:3000')
//   const lectures = await fetchingLectures(null, 'http://localhost:3000')

//   let paths = []
//   courses.forEach((course) => {
//     const courseChapters = chapters.filter(
//       (chapter) => chapter.courseId === course._id
//     )
//     courseChapters.forEach((chapter) => {
//       const chapterLectures = lectures.filter(
//         (lecture) => lecture.chapterId === chapter._id
//       )
//       chapterLectures.forEach((lecture) =>
//         paths.push(`/course/${course._id}/${lecture._id}`)
//       )
//     })
//   })

//   console.log('paths', paths)

//   return {
//     paths,
//     fallback: true,
//   }
// }

export const getServerSideProps = async (context) => {
  // const session = await getSession({ req: context.req })

  const { params } = context
  const { id } = params

  // const fetchedProps = await fetchProps(session?.user)

  return {
    props: {
      // ...fetchedProps,
      id,
      // loggedUser: session?.user ?? null,
    },
  }
}
