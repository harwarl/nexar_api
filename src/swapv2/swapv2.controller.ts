import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Swapv2Service } from './swapv2.service';
import { GetTokensQueryDto } from './dto/getTokensQuery.dto';
import { GetSwapRequestDto } from './dto/getSwapRequest.dto';
import { StartSwapDto } from './dto/startSwap.dto';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { GetTransactionDto } from './dto/getTransaction.dto';

@ApiTags('Swap V2')
@ApiSecurity('x-api-key')
@Controller({ path: 'swap', version: '2' })
export class Swapv2Controller {
  constructor(private readonly swapv2Service: Swapv2Service) {}

  @Get('tokens')
  async getAllTokens(@Query() getTokensQuery: GetTokensQueryDto) {
    return this.swapv2Service.getTokens(getTokensQuery);
  }

  // Post Swap Request
  // This will return all the partners amounts
  // This also creates a transaction body that will be saved for the user
  @Post('swap_request')
  async postSwapRequest(@Body() swapRequestDto: GetSwapRequestDto) {
    return this.swapv2Service.swapRequest(swapRequestDto);
  }

  // This endpoint is to start the swap
  @Post('start_swap')
  async startSwap(@Body() startSwapDto: StartSwapDto) {
    console.log({ startSwapDto });
    return this.swapv2Service.startSwap(startSwapDto);
  }

  @Get('transaction/:uuid_request')
  @ApiResponse({
    status: 200,
    description: 'Transaction found',
    schema: {
      example: {
        uid: 'unique-request-id-123',
        provider: 'exolix',
        from_currency: 'ETH',
        to_currency: 'USDT',
        amount: '1',
        status: 'completed',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Transaction not found or invalid request',
    schema: {
      example: {
        message: 'Could not found the exchange with uuid unique-request-id-123',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  async getTransaction(@Param() getTransactionDto: GetTransactionDto) {
    return this.swapv2Service.getTransaction(getTransactionDto.uuid_request);
  }
}
