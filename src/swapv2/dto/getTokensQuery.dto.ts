import { IsBoolean, IsNumber, IsString } from 'class-validator';

export class GetTokensQueryDto {
  @IsNumber()
  page: number;

  @IsString()
  search: string;

  @IsString()
  network: string;

  @IsBoolean()
  isActive: boolean;
}
