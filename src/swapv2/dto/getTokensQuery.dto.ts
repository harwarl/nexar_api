import { IsNumber, IsString } from 'class-validator';

export class GetTokensQuery {
  @IsNumber()
  page: number;

  @IsString()
  type: string;
}
