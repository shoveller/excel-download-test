# 자바스크립트로 엑셀 다운로드 구현하기
## 실행
```sh
pnpm dev
```

## 서버 해설
- 데이터 생성
    - [exceljs](https://github.com/exceljs/exceljs) 라는 패키지를 사용하면 자바스크립트제 서버에서 엑셀을 생성할 수 있다.
- 데이터 전송
    - 서버에 파일을 만들고, 그것을 스트림으로 보낸다.
    - 스트림 종료는 파일의 EOF를 읽으면 끝난다.
- 헤더 설정
    - `Content-Type` 헤더로 엑셀 데이터라고 명시한다.
    - `Content-Disposition` 헤더로 다운로드 하도록 명시한다.
    - `Access-Control-Expose-Headers` 헤더로 클라이언트가 `Content-Disposition` 헤더를 읽도록 허용한다.
```ts
import Koa from 'koa';  
import Router from 'koa-router';  
import bodyParser from 'koa-bodyparser';  
import { parse } from 'csv-parse/sync';  
import ExcelJS from 'exceljs';  
import fs from 'node:fs';  
import path from 'node:path';  
  
const app = new Koa();  
const router = new Router();  
  
app.use(bodyParser());  
  
// csv 를 인자로 받아서 엑셀로 만들어 반환하는 koa 서버 엔드포인트  
router.get('/convert-csv-to-excel', async (ctx) => {  
    try {  
        // test.csv 파일에서 직접 읽기  
        const csv = fs.readFileSync(path.resolve(process.cwd(), 'test.csv'), 'utf-8');  
  
        if (!csv) {  
            ctx.status = 400;  
            ctx.body = { error: 'CSV 데이터를 읽을 수 없습니다' };  
            return;  
        }  
  
        // CSV 문자열을 파싱하여 배열로 변환  
        const records = parse(csv, {  
            columns: true,  
            skip_empty_lines: true  
        });  
  
        // Excel 워크북 생성  
        const workbook = new ExcelJS.Workbook();  
        const worksheet = workbook.addWorksheet('Sheet 1');  
  
        if (records.length > 0) {  
            // 헤더 추가  
            const headers = Object.keys(records[0]);  
            worksheet.columns = headers.map(header => ({ header, key: header }));  
  
            // 데이터 추가  
            worksheet.addRows(records);  
        }  
  
        // 파일로 직접 저장 (테스트용)  
        const tempFilePath = path.resolve(process.cwd(), 'temp.xlsx');  
        await workbook.xlsx.writeFile(tempFilePath);  
  
        // 스프레드 시트 컨텐츠를 명시한다
        ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');  
        // 다운로드 해야 하는 파일이라는 것을 명시한다
        ctx.set('Content-Disposition', 'attachment; filename=converted.xlsx');  
        // 파일 이름을 클라이언트가 읽을 수 있게 허용한다.
        ctx.set('Access-Control-Expose-Headers', 'Content-Disposition');  
	    
	    // 임시 파일을 스트림으로 읽어서 반환  
        ctx.body = fs.createReadStream(tempFilePath);  
    } catch (error) {  
        console.error('변환 중 오류 발생:', error);  
        ctx.status = 500;  
        ctx.body = { error: '변환 중 오류가 발생했습니다' };  
    }  
});  
  
// 라우터와 서버 시작  
app.use(router.routes()).use(router.allowedMethods());  
  
const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => {  
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);  
});
```

## 클라이언트 해설
### 파일 이름 추출
- 서버에서 `Content-Disposition` 헤더로 파일 이름을 내려주면 읽어들일 수 있다.
- 이 기능을 사용하려면 서버에서 `Access-Control-Expose-Headers` 헤더로 `Content-Disposition` 헤더 접근을 허용해야 한다.
```ts
const getFileName = (contentDisposition: string) => {
	const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
	if (filenameMatch && filenameMatch[1]) {
		return filenameMatch[1].replace(/['"]/g, '');
	}

	return ''
}
```

### api 구현
- 2가지 경우의 수를 준비했다.
#### fetch 로 api 구현
- fetch 는 읽는 방법을 따로 지정해야 한다.
- 엑셀 파일이 스트림 데이터이므로 읽을 때 `async` ~ `await` 구문을 사용해야 한다.
- 특이하게도 헤더 이름을 소문자로 처리한다.
```tsx
const getExcelFromFetch = async () => {  
  const res = await fetch('/api/convert-csv-to-excel')  
  const file = await res.blob()  
  const contentDisposition = res.headers.get('Content-Disposition') || ''  
  
  return {  
    file,  
    filename: getFileName(contentDisposition)  
  }  
}
```

#### axios 로 api 구현
- axios 는 읽는 방법을 자체 옵션으로 구현해 두었다.
- 별도의 스트림 처리가 필요하지 않다.
- 헤더를 소문자로 처리하는 특징이 있다.
```tsx
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
```

### 다운로드 구현
- 2가지 경우의 수를 준비했다.
#### 앵커로 다운로드
- 가상의 anchor 엘리먼트를 만들고, 이것을 클릭하는 방식이 가장 널리 알려져 있다.
```ts
const downloadByAnchor = ({ file, filename }:{ file: Blob, filename: string }) => {
	const url = URL.createObjectURL(file)
	const anchor = document.createElement('a')
	anchor.download = filename
	anchor.href = url
	anchor.click()
	URL.revokeObjectURL(url)
}
```

#### 파일 세이버로 다운로드
- [FileSaver.js](https://www.npmjs.com/package/file-saver) 는 크로스 브라우징을 지원하고 대용량 파일 다운로드를 지원한다고 알려져 있다.
```sh
pnpm i file-saver
pnpm i @types/file-saver -D
```

- 사용하지 않았을 경우의 부작용은 모르지만, 인터페이스는 확실히 간결해진다.
```tsx
import { saveAs } from 'file-saver';

saveAs(file, filename)
```


