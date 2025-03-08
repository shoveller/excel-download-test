import axios from "axios"
import { saveAs } from 'file-saver';

/**
 * axios 로 엑셀 다운로드를 시도
 */
const getExcelFromAxios = async () => {
  const res = await axios.get<Blob>('/api/convert-csv-to-excel', {
    responseType: 'blob'
  })
  const contentDisposition = res.headers['content-disposition'] || ''

  return {
    file: res.data,
    filename: getFileName(contentDisposition)
  }
}

/**
 * fetch 로 엑셀 다운로드를 시도
 */
const getExcelFromFetch = async () => {
  const res = await fetch('/api/convert-csv-to-excel')
  const file = await res.blob()
  const contentDisposition = res.headers.get('Content-Disposition') || ''

  return {
    file,
    filename: getFileName(contentDisposition)
  }
}

/**
 * Content-Disposition 헤더에서 파일 이름을 추출
 * @param contentDisposition
 */
const getFileName = (contentDisposition: string) => {
  const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);

  if (filenameMatch && filenameMatch[1]) {
    return filenameMatch[1].replace(/['"]/g, '');
  }

  return ''
}

// 가상 앵커로 다운로드를 시도
const downloadByAnchor = ({ file, filename }:{ file: Blob, filename: string }) => {
  const url = URL.createObjectURL(file)

  const anchor = document.createElement('a')
  anchor.download = filename
  anchor.href = url
  anchor.click()

  URL.revokeObjectURL(url)
}

function App() {
  const onClick = async() => {
    // axios 사용 가능
    const {file, filename} = await getExcelFromAxios()
    // fetch 사용 가능
    // const {file, filename} = await getExcelFromFetch()
    // 다운로드를 손수 구현할 수 있다.
    // downloadByAnchor({ file, filename })
    // 파일세이버로 다운로드를 구현할 수 있다.
    saveAs(file, filename)
  }

  return (
    <button onClick={onClick}>엑셀 다운로드</button>
  )
}

export default App
