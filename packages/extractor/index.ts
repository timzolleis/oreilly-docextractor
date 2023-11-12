import {BookExtractor} from "./src/book";

type ExtractBookProps = {
    firstBookUrl: string;
    bookName: string;
    outputDirectory: string;
    institutionEmail: string;
}


export * from "./src/book"