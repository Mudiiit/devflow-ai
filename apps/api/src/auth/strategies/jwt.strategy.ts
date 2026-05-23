import { Injectable } from '@nestjs/common';
import { JwtService } from '../services/jwt.service.js';

@Injectable()
export class JwtStrategy {
  constructor(private readonly jwtService: JwtService) {}

  validate(token: string) {
    return this.jwtService.verifyAccessToken(token);
  }
}