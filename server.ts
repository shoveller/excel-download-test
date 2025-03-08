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
