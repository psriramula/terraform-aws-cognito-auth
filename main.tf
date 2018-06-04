# Copyright (c) 2018 Martin Donath <martin.donath@squidfunk.com>

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to
# deal in the Software without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
# sell copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
# IN THE SOFTWARE.

# -----------------------------------------------------------------------------
# Modules
# -----------------------------------------------------------------------------

# data.aws_caller_identity._
data "aws_caller_identity" "_" {}

# -----------------------------------------------------------------------------
# Modules
# -----------------------------------------------------------------------------

# module.api
module "api" {
  source = "./modules/api"

  namespace = "${var.namespace}"
  region    = "${var.region}"

  api_stage = "${var.api_stage}"

  cognito_user_pool        = "${module.identity.cognito_user_pool}"
  cognito_user_pool_arn    = "${module.identity.cognito_user_pool_arn}"
  cognito_user_pool_client = "${module.identity.cognito_user_pool_client}"
  cognito_identity_domain  = "${var.cognito_identity_domain}"
}

# module.identity
module "identity" {
  source = "./modules/identity"

  namespace = "${var.namespace}"
  region    = "${var.region}"

  cognito_identity_pool   = "${var.cognito_identity_pool}"
  cognito_identity_domain = "${var.cognito_identity_domain}"
}