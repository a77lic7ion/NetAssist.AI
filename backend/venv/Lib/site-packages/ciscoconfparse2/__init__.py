r"""__init__.py - Parse, Query, Build, and Modify IOS-style configurations

Copyright (C) 2023 David Michael Pennington

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

If you need to contact the author, you can do so by emailing:
mike [~at~] pennington [.dot.] net
"""

from ciscoconfparse2.ccp_util import (
    CiscoIOSInterface,
    CiscoIOSXRInterface,
    CiscoRange,
    EUI64Obj,
    IPv4Obj,
    IPv6Obj,
    L4Object,
    MACObj,
    PythonOptimizeCheck,
    _get_ipv4,
    _get_ipv6,
    ccp_logger_control,
    collapse_addresses,
    configure_loguru,
    dns_query,
    ip_factory,
)
from ciscoconfparse2.ciscoconfparse2 import *
from ciscoconfparse2.cli_script import ccp_script_entry

# Throw errors for PYTHONOPTIMIZE and `python -O ...` by executing
#     PythonOptimizeCheck()...
_ = PythonOptimizeCheck()
