/*
 * Copyright (c) 2018 Martin Donath <martin.donath@squidfunk.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { CognitoIdentityServiceProvider } from "aws-sdk"
import * as uuid from "uuid/v4"

import { Client } from ".."
import {
  Verification,
  VerificationCode,
  VerificationContext
} from "../../verification"
import { Session } from "../session"

/* ----------------------------------------------------------------------------
 * Functions
 * ------------------------------------------------------------------------- */

/**
 * Create an ISO 8601 date string for a specific time in the future
 *
 * @param seconds - Validity in seconds
 *
 * @return Expiry date in ISO 8601
 */
export function expires(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

/* ----------------------------------------------------------------------------
 * Class
 * ------------------------------------------------------------------------- */

/**
 * Authentication client
 */
export class AuthenticationClient extends Client {

  /**
   * Initialize verification and identity provider
   *
   * @param verification - Verification provider
   * @param cognito - Cognito client
   */
  public constructor(
    protected verification = new Verification(),
    cognito = new CognitoIdentityServiceProvider({
      apiVersion: "2016-04-18"
    })
  ) {
    super(cognito)
  }

  /**
   * Register user with email address and password
   *
   * @param email - Email address
   * @param password Password
   *
   * @return Promise resolving with verification code
   */
  public async register(
    email: string, password: string
  ): Promise<VerificationCode> {
    const username = uuid()
    const [, code] = await Promise.all([

      /* Register user with Cognito */
      this.cognito.signUp({
        ClientId: process.env.COGNITO_USER_POOL_CLIENT!,
        Username: username,
        Password: password,
        UserAttributes: [
          {
            Name: "email",
            Value: email
          }
        ]
      }).promise(),

      /* Issue verification code */
      this.verification.issue("register", username)
    ])

    /* Return verification code */
    return code
  }

  /**
   * Claim verification code
   *
   * @param context - Verification context
   * @param id - Verification code identifier
   *
   * @return Verification code
   */
  public verify(
    context: VerificationContext, id: string
  ): Promise<VerificationCode> {
    return this.verification.claim(context, id)
  }

  /**
   * Authenticate using credentials or refresh token
   *
   * @param usernameOrToken - Username, email address or refresh token
   * @param password - Password if username is supplied
   *
   * @return Promise resolving with session
   */
  public authenticate(
    usernameOrToken: string, password?: string
  ): Promise<Session> {
    return password
      ? this.authenticateWithCredentials(usernameOrToken, password)
      : this.authenticateWithToken(usernameOrToken)
  }

  /**
   * Trigger authentication flow for lost password
   *
   * @param username - Username or email address
   *
   * @return Promise resolving with verification code
   */
  public async forgotPassword(username: string): Promise<VerificationCode> {
    const { Username: id } = await this.cognito.adminGetUser({
      UserPoolId: process.env.COGNITO_USER_POOL!,
      Username: username
    }).promise()

    /* Issue and return verification code */
    return this.verification.issue("reset", id)
  }

  /**
   * Authenticate using username or email and password
   *
   * @param username - Username or email address
   * @param password - Password
   *
   * @return Promise resolving with session
   */
  protected async authenticateWithCredentials(
    username: string, password: string
  ): Promise<Session> {
    const { AuthenticationResult, ChallengeName } =
      await this.cognito.initiateAuth({
        ClientId: process.env.COGNITO_USER_POOL_CLIENT!,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password
        }
      }).promise()

    /* Return session if authenticated */
    if (!AuthenticationResult)
      throw new Error(`Invalid authentication: challenge "${ChallengeName}"`)
    return {
      access: {
        token: AuthenticationResult.IdToken!,
        expires: expires(60 * 60) /* 1 hour */
      },
      ...(AuthenticationResult.RefreshToken
        ? {
          refresh: {
            token: AuthenticationResult.RefreshToken,
            expires: expires(60 * 60 * 24 * 30) /* 30 days */
          }
        }
        : {})
    }
  }

  /**
   * Re-authenticate using refresh token
   *
   * @param token - Refresh token
   *
   * @return Promise resolving with session
   */
  protected async authenticateWithToken(
    token: string
  ): Promise<Session> {
    const { AuthenticationResult, ChallengeName } =
      await this.cognito.initiateAuth({
        ClientId: process.env.COGNITO_USER_POOL_CLIENT!,
        AuthFlow: "REFRESH_TOKEN",
        AuthParameters: {
          REFRESH_TOKEN: token
        }
      }).promise()

    /* Return renewed session if authenticated */
    if (!AuthenticationResult)
      throw new Error(`Invalid authentication: challenge "${ChallengeName}"`)
    return {
      access: {
        token: AuthenticationResult.IdToken!,
        expires: expires(60 * 60) /* 1 hour */
      }
    }
  }
}